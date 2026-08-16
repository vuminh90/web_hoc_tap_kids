"""Windows kiosk watchdog for the kids learning portal (stdlib only)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

APP_ORIGIN = os.getenv("KIDS_APP_ORIGIN", "http://127.0.0.1:3000")
API_ORIGIN = os.getenv("KIDS_API_ORIGIN", "http://127.0.0.1:8000")
DEBUG_PORT = 9222
STUDENTS = ("vuanhduc", "vuanhthu")
POLL_SECONDS = 2
PROFILE_DIR = Path(os.getenv("LOCALAPPDATA", str(Path.home()))) / "KidsLearningKiosk"


def find_edge() -> Path:
    candidates = [
        Path(os.getenv("PROGRAMFILES(X86)", "")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.getenv("PROGRAMFILES", "")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.getenv("LOCALAPPDATA", "")) / "Microsoft/Edge/Application/msedge.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("Không tìm thấy Microsoft Edge.")


def api_get(path: str, student: str):
    request = urllib.request.Request(f"{API_ORIGIN}{path}", headers={"X-Student": student})
    with urllib.request.urlopen(request, timeout=3) as response:
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


def edge_tabs():
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json", timeout=1) as response:
            return json.load(response)
    except (OSError, ValueError, urllib.error.URLError):
        return []


def browser_url():
    pages = [tab for tab in edge_tabs() if tab.get("type") == "page"]
    return pages[0].get("url", "") if pages else ""


def host_allowed(current_url: str, game_url: str):
    current = urlparse(current_url)
    game = urlparse(game_url)
    if current.hostname in {"127.0.0.1", "localhost"}:
        return True
    if not current.hostname or not game.hostname:
        return False
    return current.hostname == game.hostname or current.hostname.endswith(f".{game.hostname}")


class KioskBrowser:
    def __init__(self):
        self.edge = find_edge()
        self.process = None

    def launch(self, url: str):
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        args = [
            str(self.edge),
            f"--kiosk={url}",
            "--edge-kiosk-type=fullscreen",
            "--no-first-run",
            "--disable-pinch",
            "--overscroll-history-navigation=0",
            f"--remote-debugging-port={DEBUG_PORT}",
            f"--user-data-dir={PROFILE_DIR}",
        ]
        self.process = subprocess.Popen(args, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)

    def running(self):
        return self.process is not None and self.process.poll() is None

    def close(self):
        if not self.process:
            return
        subprocess.run(["taskkill", "/PID", str(self.process.pid), "/T", "/F"], capture_output=True)
        self.process = None


def wait_for_server():
    for _ in range(60):
        try:
            urllib.request.urlopen(f"{APP_ORIGIN}/", timeout=1).close()
            urllib.request.urlopen(f"{API_ORIGIN}/", timeout=1).close()
            return
        except OSError:
            time.sleep(1)
    raise RuntimeError("Frontend hoặc backend chưa khởi động.")


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
