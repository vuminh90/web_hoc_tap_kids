"""Cross-platform kiosk watchdog for the kids learning portal (stdlib only)."""
from __future__ import annotations

import argparse
import ctypes
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
LAUNCH_GRACE_SECONDS = 10
MAX_URL_MISMATCHES = 4
IS_WINDOWS = platform.system() == "Windows"
PROFILE_ROOT = os.getenv("KIDS_KIOSK_STATE_DIR")
if not PROFILE_ROOT:
    PROFILE_ROOT = os.getenv("LOCALAPPDATA") if IS_WINDOWS else os.getenv("XDG_STATE_HOME")
PROFILE_DIR = Path(PROFILE_ROOT or (Path.home() / ".local/state")) / "KidsLearningKiosk"
HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    "Accept": "application/json,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
}
MUTEX_HANDLE = None


def configure_origins():
    global APP_ORIGIN, API_ORIGIN
    parser = argparse.ArgumentParser(description="Kids game kiosk controller")
    parser.add_argument("--app-origin", default=APP_ORIGIN)
    parser.add_argument("--api-origin", default=API_ORIGIN)
    args = parser.parse_args()
    APP_ORIGIN = args.app_origin.rstrip("/")
    API_ORIGIN = args.api_origin.rstrip("/")


def log(message: str):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    try:
        print(line, flush=True)
    except (AttributeError, OSError):
        pass
    try:
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        with (PROFILE_DIR / "kiosk.log").open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass


def ensure_single_instance():
    global MUTEX_HANDLE
    if not IS_WINDOWS:
        return True
    MUTEX_HANDLE = ctypes.windll.kernel32.CreateMutexW(None, False, "Local\\KidsLearningKiosk")
    return ctypes.windll.kernel32.GetLastError() != 183


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


def api_post(path: str, student: str):
    request = urllib.request.Request(
        f"{API_ORIGIN}{path}",
        data=b"",
        headers={**HTTP_HEADERS, "X-Student": student},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)


def active_game():
    active_sessions = []
    for student in STUDENTS:
        wallet = api_get("/api/play/wallet", student)
        session = wallet.get("session")
        if session and session.get("status") == "active" and wallet.get("balanceSeconds", 0) > 0:
            sites = api_get("/api/play/sites", student)
            site = next((item for item in sites if item.get("id") == session.get("site_id")), None)
            if site:
                active_sessions.append((student, wallet, site))
    if not active_sessions:
        return None
    return max(active_sessions, key=lambda item: item[1]["session"].get("started_at", 0))


def browser_tabs():
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json", timeout=1) as response:
            return json.load(response)
    except (OSError, ValueError, urllib.error.URLError):
        return []


def browser_pages():
    return [tab for tab in browser_tabs() if tab.get("type") == "page"]


def browser_url():
    pages = browser_pages()
    return pages[0].get("url", "") if pages else ""


def game_page(game_url: str):
    return next(
        (tab for tab in browser_pages() if game_host_allowed(tab.get("url", ""), game_url)),
        None,
    )


def browser_urls():
    return [tab.get("url", "") for tab in browser_pages()]


def websocket_send_json(websocket_url: str, payload: dict):
    parsed = urlparse(websocket_url)
    connection = socket.create_connection((parsed.hostname, parsed.port or 80), timeout=2)
    try:
        key = base64.b64encode(os.urandom(16)).decode()
        target = parsed.path if not parsed.query else f"{parsed.path}?{parsed.query}"
        request = (
            f"GET {target} HTTP/1.1\r\n"
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


def inject_timer(seconds: int, game_name: str, game_url: str):
    pages = [
        tab for tab in browser_pages()
        if tab.get("webSocketDebuggerUrl") and game_host_allowed(tab.get("url", ""), game_url)
    ]
    if not pages:
        return False
    deadline = int(time.time() * 1000) + max(0, int(seconds)) * 1000
    stop_url = f"{APP_ORIGIN}/play/stop?kiosk=1"
    script = f"""
(() => {{
  const id = 'kids-kiosk-countdown';
  const backId = 'kids-kiosk-back';
  let timer = document.getElementById(id);
  let back = document.getElementById(backId);
  if (!timer) {{
    timer = document.createElement('div');
    timer.id = id;
    timer.setAttribute('role', 'timer');
    document.documentElement.appendChild(timer);
  }}
  if (!back) {{
    back = document.createElement('button');
    back.id = backId;
    back.type = 'button';
    document.documentElement.appendChild(back);
  }}
  timer.style.cssText = [
    'position:fixed',
    'top:14px',
    'right:18px',
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'padding:12px 18px',
    'border-radius:999px',
    'background:#111827',
    'color:#FFFFFF',
    'font:800 24px Arial,sans-serif',
    'line-height:1',
    'letter-spacing:0',
    'box-shadow:0 6px 22px rgba(0,0,0,.45)',
    'border:4px solid #FDD835',
    'pointer-events:none',
    'user-select:none',
    'opacity:.98'
  ].join(';');
  back.style.cssText = [
    'position:fixed',
    'top:14px',
    'left:18px',
    'z-index:2147483647',
    'padding:12px 18px',
    'border-radius:999px',
    'background:#111827',
    'color:#FFFFFF',
    'font:800 22px Arial,sans-serif',
    'line-height:1',
    'letter-spacing:0',
    'box-shadow:0 6px 22px rgba(0,0,0,.45)',
    'border:4px solid #FDD835',
    'cursor:pointer',
    'user-select:none',
    'opacity:.98'
  ].join(';');
  back.textContent = 'Quay lai';
  back.setAttribute('aria-label', 'Quay lai khu vui choi');
  back.onclick = () => {{
    back.disabled = true;
    back.textContent = 'Dang quay lai...';
    window.location.href = {json.dumps(stop_url)};
  }};
  timer.dataset.deadline = '{deadline}';
  timer.dataset.game = {json.dumps(game_name)};
  const render = () => {{
    const left = Math.max(0, Math.ceil((Number(timer.dataset.deadline) - Date.now()) / 1000));
    const minutes = Math.floor(left / 60);
    const secs = String(left % 60).padStart(2, '0');
    timer.textContent = `Con lai ${{minutes}}:${{secs}}`;
    timer.style.background = left <= 60 ? '#B91C1C' : '#111827';
    timer.style.borderColor = left <= 60 ? '#FFFFFF' : '#FDD835';
  }};
  render();
  if (!window.__kidsKioskTimerInterval) window.__kidsKioskTimerInterval = setInterval(render, 250);
}})();
"""
    injected = False
    for index, page in enumerate(pages):
        injected = websocket_send_json(page["webSocketDebuggerUrl"], {
            "id": (int(time.time() * 1000) + index) % 1000000,
            "method": "Runtime.evaluate",
            "params": {"expression": script},
        }) or injected
    return injected


def game_host_allowed(current_url: str, game_url: str):
    current = urlparse(current_url)
    game = urlparse(game_url)
    if not current.hostname or not game.hostname:
        return False
    current_host = current.hostname.lower().removeprefix("www.")
    game_host = game.hostname.lower().removeprefix("www.")
    return (
        current_host == game_host
        or current_host.endswith(f".{game_host}")
        or game_host.endswith(f".{current_host}")
    )


def is_transient_browser_url(current_url: str):
    if not current_url:
        return True
    parsed = urlparse(current_url)
    return parsed.scheme in ("", "about", "edge", "chrome", "devtools")


def is_stop_request(current_url: str):
    if not current_url:
        return False
    current = urlparse(current_url)
    app = urlparse(APP_ORIGIN)
    return (
        current.hostname == app.hostname
        and (current.port or default_port(current.scheme)) == (app.port or default_port(app.scheme))
        and current.path == "/play/stop"
    )


def default_port(scheme: str):
    return 443 if scheme == "https" else 80


class KioskBrowser:
    def __init__(self):
        self.browser = find_browser()
        self.process = None
        self.last_launch_at = 0
        self.url_mismatches = 0

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
        self.last_launch_at = time.time()
        self.url_mismatches = 0
        log(f"Launched browser: {url}")

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
        self.url_mismatches = 0


def wait_for_server():
    log(f"Connecting to {APP_ORIGIN} ...")
    last_error = None
    for _ in range(60):
        try:
            app_request = urllib.request.Request(f"{APP_ORIGIN}/", headers=HTTP_HEADERS)
            api_request = urllib.request.Request(f"{API_ORIGIN}/", headers=HTTP_HEADERS)
            urllib.request.urlopen(app_request, timeout=5).close()
            urllib.request.urlopen(api_request, timeout=5).close()
            log("Portal is reachable. Starting kiosk browser.")
            return
        except OSError as error:
            last_error = error
            time.sleep(1)
    raise RuntimeError(f"Không kết nối được portal sau 60 giây: {last_error}")


def main():
    configure_origins()
    if not ensure_single_instance():
        log("Another KidsKiosk instance is already running.")
        return 0
    wait_for_server()
    browser = KioskBrowser()
    log(f"Using browser: {browser.browser}")
    last_had_game = False
    try:
        while True:
            try:
                active = active_game()
            except OSError:
                active = None
            if active:
                student, wallet, site = active
                target = site["url"]
                last_had_game = True
                if not browser.running():
                    browser.launch(target)
                else:
                    requested_url = browser_url()
                    if is_stop_request(requested_url):
                        try:
                            api_post("/api/play/sessions/stop", student)
                            log(f"Stopped play session by back button: {student}")
                        except OSError as error:
                            log(f"Failed to stop play session by back button: {error}")
                        browser.close()
                        browser.launch(f"{APP_ORIGIN}/play?kiosk=1")
                        last_had_game = False
                        time.sleep(POLL_SECONDS)
                        continue
                    allowed_page = game_page(target)
                    current = allowed_page.get("url", "") if allowed_page else browser_url()
                    launch_age = time.time() - browser.last_launch_at
                    if allowed_page:
                        browser.url_mismatches = 0
                        inject_timer(wallet.get("balanceSeconds", 0), site.get("name", "Game"), target)
                    elif is_transient_browser_url(current) or launch_age < LAUNCH_GRACE_SECONDS:
                        browser.url_mismatches = 0
                    else:
                        browser.url_mismatches += 1
                        log(
                            f"Game URL mismatch {browser.url_mismatches}/{MAX_URL_MISMATCHES}: "
                            f"current={current} target={target} pages={browser_urls()}"
                        )
                        if browser.url_mismatches >= MAX_URL_MISMATCHES:
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
    try:
        sys.exit(main())
    except Exception as error:
        log(f"Fatal error: {type(error).__name__}: {error}")
        raise
