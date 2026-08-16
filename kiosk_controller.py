"""Cross-platform kiosk watchdog for the kids learning portal (stdlib only)."""
from __future__ import annotations

import json
import os
import platform
import shutil
import signal
import socket
import subprocess
import struct
import sys
import time
import urllib.error
import urllib.request
import base64
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


def websocket_send_json(websocket_url: str, payload: dict):
    parsed = urlparse(websocket_url)
    connection = socket.create_connection((parsed.hostname, parsed.port or 80), timeout=2)
    try:
        key = base64.b64encode(os.urandom(16)).decode()
        request = (
            f"GET {parsed.path}?{parsed.query} HTTP/1.1\r\n"
            f"Host: {parsed.hostname}:{parsed.port or 80}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        connection.sendall(request.encode())
        response = b""
        while b"\r\n\r\n" not in response:
            response += connection.recv(4096)
        if b" 101 " not in response.split(b"\r\n", 1)[0]:
            return False
        data = json.dumps(payload).encode()
        mask = os.urandom(4)
        length = len(data)
        header = bytearray([0x81])
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack("!H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack("!Q", length))
        masked = bytes(value ^ mask[index % 4] for index, value in enumerate(data))
        connection.sendall(bytes(header) + mask + masked)
        return True
    finally:
        connection.close()


def inject_timer(seconds: int, game_name: str):
    pages = [tab for tab in browser_tabs() if tab.get("type") == "page" and tab.get("webSocketDebuggerUrl")]
    if not pages:
        return False
    deadline = int(time.time() * 1000) + max(0, int(seconds)) * 1000
    script = f"""
(() => {{
  const id = 'kids-kiosk-countdown';
  let timer = document.getElementById(id);
  if (!timer) {{
    timer = document.createElement('div');
    timer.id = id;
    timer.setAttribute('role', 'timer');
    timer.style.cssText = 'position:fixed;top:14px;right:18px;z-index:2147483647;padding:12px 18px;border-radius:16px;background:#263238;color:white;font:700 22px Arial,sans-serif;box-shadow:0 5px 18px rgba(0,0,0,.38);border:3px solid #80DEEA;pointer-events:none;';
    document.documentElement.appendChild(timer);
  }}
  timer.dataset.deadline = '{deadline}';
  timer.dataset.game = {json.dumps(game_name)};
  const render = () => {{
    const left = Math.max(0, Math.ceil((Number(timer.dataset.deadline) - Date.now()) / 1000));
    const minutes = Math.floor(left / 60);
    const secs = String(left % 60).padStart(2, '0');
    timer.textContent = `⏱ ${{minutes}}:${{secs}}`;
    timer.style.background = left <= 60 ? '#C62828' : '#263238';
  }};
  render();
  if (!window.__kidsKioskTimerInterval) window.__kidsKioskTimerInterval = setInterval(render, 250);
}})();
"""
    return websocket_send_json(pages[0]["webSocketDebuggerUrl"], {
        "id": int(time.time() * 1000) % 1000000,
        "method": "Runtime.evaluate",
        "params": {"expression": script},
    })


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
                _, wallet, site = active
                target = site["url"]
                last_had_game = True
                if not browser.running():
                    browser.launch(target)
                else:
                    current = browser_url()
                    if current and not host_allowed(current, target):
                        browser.close()
                        browser.launch(target)
                    elif current:
                        inject_timer(wallet.get("balanceSeconds", 0), site.get("name", "Game"))
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
