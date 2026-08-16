"""Cross-platform kiosk watchdog for the kids learning portal (stdlib only)."""
from __future__ import annotations

import json
import os
import platform
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

APP_ORIGIN = os.getenv("KIDS_APP_ORIGIN", "http://127.0.0.1:3000").rstrip("/")
API_ORIGIN = os.getenv("KIDS_API_ORIGIN", APP_ORIGIN).rstrip("/")
DEBUG_PORT = int(os.getenv("KIDS_KIOSK_DEBUG_PORT", "9222"))
STUDENTS = ("vuanhduc", "vuanhthu")
POLL_SECONDS = 2
IS_WINDOWS = platform.system() == "Windows"
PROFILE_ROOT = os.getenv("LOCALAPPDATA") if IS_WINDOWS else os.getenv("XDG_STATE_HOME")
PROFILE_DIR = Path(PROFILE_ROOT or (Path.home() / ".local/state")) / "KidsLearningKiosk"
HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    "Accept": "application/json,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
}


def find_browser() -> Path:
    if IS_WINDOWS:
        candidates = [
            Path(os.getenv("PROGRAMFILES(X86)", "")) / "Microsoft/Edge/Application/msedge.exe",
            Path(os.getenv("PROGRAMFILES", "")) / "Microsoft/Edge/Application/msedge.exe",
            Path(os.getenv("LOCALAPPDATA", "")) / "Microsoft/Edge/Application/msedge.exe",
        ]
        for candidate in candidates:
            if candidate.is_file():
                return candidate
    else:
        for command in ("microsoft-edge", "microsoft-edge-stable", "google-chrome", "chromium", "chromium-browser"):
            executable = shutil.which(command)
            if executable:
                return Path(executable)
    raise FileNotFoundError("Không tìm thấy Microsoft Edge, Google Chrome hoặc Chromium.")


def api_get(path: str, student: str):
    request = urllib.request.Request(
        f"{API_ORIGIN}{path}", headers={**HTTP_HEADERS, "X-Student": student}
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)


def active_game():
    for student in STUDENTS:
        wallet = api_get("/api/play/wallet", student)
        session = wallet.get("session")
        if session and session.get("status") == "active" and wallet.get("balanceSeconds", 0) > 0:
            sites = api_get("/api/play/sites", student)
            site = next((item for item in sites if item.get("id") == session.get("site_id")), None)
            if site:
                return student, wallet, site
    return None


def browser_tabs():
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json", timeout=1) as response:
            return json.load(response)
    except (OSError, ValueError, urllib.error.URLError):
        return []


def browser_url():
    pages = [tab for tab in browser_tabs() if tab.get("type") == "page"]
    return pages[0].get("url", "") if pages else ""


def host_allowed(current_url: str, game_url: str):
    current = urlparse(current_url)
    game = urlparse(game_url)
    app_host = urlparse(APP_ORIGIN).hostname
    if current.hostname in {"127.0.0.1", "localhost", app_host}:
        return True
    if not current.hostname or not game.hostname:
        return False
    return current.hostname == game.hostname or current.hostname.endswith(f".{game.hostname}")


class KioskBrowser:
    def __init__(self):
        self.browser = find_browser()
        self.process = None

    def launch(self, url: str):
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        args = [
            str(self.browser), "--kiosk", url, "--no-first-run", "--disable-pinch",
            "--overscroll-history-navigation=0", f"--remote-debugging-port={DEBUG_PORT}",
            f"--user-data-dir={PROFILE_DIR}",
        ]
        if IS_WINDOWS:
            args.insert(3, "--edge-kiosk-type=fullscreen")
            self.process = subprocess.Popen(args, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        else:
            if hasattr(os, "geteuid") and os.geteuid() == 0:
                args.append("--no-sandbox")
            self.process = subprocess.Popen(args, start_new_session=True)

    def running(self):
        return self.process is not None and self.process.poll() is None

    def close(self):
        if not self.process:
            return
        if IS_WINDOWS:
            subprocess.run(["taskkill", "/PID", str(self.process.pid), "/T", "/F"], capture_output=True)
        else:
            try:
                os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                except ProcessLookupError:
                    pass
            except ProcessLookupError:
                pass
        self.process = None


def wait_for_server():
    print(f"Connecting to {APP_ORIGIN} ...", flush=True)
    last_error = None
    for _ in range(60):
        try:
            app_request = urllib.request.Request(f"{APP_ORIGIN}/", headers=HTTP_HEADERS)
            api_request = urllib.request.Request(f"{API_ORIGIN}/", headers=HTTP_HEADERS)
            urllib.request.urlopen(app_request, timeout=5).close()
            urllib.request.urlopen(api_request, timeout=5).close()
            print("Portal is reachable. Starting kiosk browser.", flush=True)
            return
        except OSError as error:
            last_error = error
            time.sleep(1)
    raise RuntimeError(f"Không kết nối được portal sau 60 giây: {last_error}")


def main():
    wait_for_server()
    browser = KioskBrowser()
    last_had_game = False
    try:
        while True:
            try:
                active = active_game()
            except OSError:
                active = None
            if active:
                _, _, site = active
                target = site["url"]
                last_had_game = True
                if not browser.running():
                    browser.launch(target)
                else:
                    current = browser_url()
                    if current and not host_allowed(current, target):
                        browser.close()
                        browser.launch(target)
            else:
                target = f"{APP_ORIGIN}/play/locked?kiosk=1" if last_had_game else f"{APP_ORIGIN}/?kiosk=1"
                if last_had_game or not browser.running():
                    browser.close()
                    browser.launch(target)
                    last_had_game = False
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        browser.close()
        return 0


if __name__ == "__main__":
    sys.exit(main())
