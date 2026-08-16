from fastapi import FastAPI, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import binascii
import hashlib
import hmac
import json
import os
import tempfile
import threading
import time
import uuid
from urllib.parse import urlparse
import models
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Offline Learning App API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PARENT_PASSWORD = os.getenv("PARENT_PASSWORD", "vuminh1990")
AUTH_SECRET = os.getenv("AUTH_SECRET", hashlib.sha256(f"kids-learning:{PARENT_PASSWORD}".encode()).hexdigest())
TOKEN_TTL_SECONDS = 8 * 60 * 60
PLAY_USERS = {"vuanhduc", "vuanhthu"}
DATA_LOCK = threading.RLock()

class ParentLogin(BaseModel):
    password: str

class PlayReward(BaseModel):
    minutes: int
    reward_name: str = "Thời gian chơi game"

class PlaySessionStart(BaseModel):
    site_id: str

class GameSiteInput(BaseModel):
    id: str | None = None
    name: str
    url: str
    description: str = ""
    thumbnail_url: str = ""
    open_mode: str = "kiosk"
    enabled: bool = True
    allowed_for: list[str] = ["vuanhduc", "vuanhthu"]

class TimeAdjustment(BaseModel):
    username: str
    minutes: int
    note: str = "Phụ huynh điều chỉnh"

def create_parent_token():
    expires_at = int(time.time()) + TOKEN_TTL_SECONDS
    payload = f"parent:{expires_at}"
    signature = hmac.new(AUTH_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{signature}".encode()).decode()

def verify_parent_token(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Parent authentication required")
    try:
        decoded = base64.urlsafe_b64decode(authorization[7:].encode()).decode()
        role, expires_at, signature = decoded.split(":", 2)
        payload = f"{role}:{expires_at}"
        expected = hmac.new(AUTH_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if role != "parent" or int(expires_at) < int(time.time()) or not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid token")
    except (ValueError, TypeError, binascii.Error):
        raise HTTPException(status_code=401, detail="Invalid or expired parent session")
    return True

@app.post("/api/parent/login")
def parent_login(credentials: ParentLogin):
    if not hmac.compare_digest(credentials.password, PARENT_PASSWORD):
        raise HTTPException(status_code=401, detail="Mật khẩu không đúng")
    return {"token": create_parent_token(), "expiresIn": TOKEN_TTL_SECONDS}

@app.get("/api/parent/verify")
def verify_parent_session(_: bool = Depends(verify_parent_token)):
    return {"valid": True}

@app.get("/")
def read_root():
    return {"message": "Learning API is running!"}

@app.get("/users/")
def get_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

from fastapi import Request

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data_store.json")

def load_data():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except:
            return {}

def save_data(data):
    directory = os.path.dirname(DATA_FILE)
    fd, temporary_path = tempfile.mkstemp(prefix="learning-data-", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(temporary_path, DATA_FILE)
    finally:
        if os.path.exists(temporary_path):
            os.remove(temporary_path)

def require_student(x_student: str | None = Header(default=None)):
    if x_student not in PLAY_USERS:
        raise HTTPException(status_code=401, detail="Tài khoản học sinh không hợp lệ")
    return x_student

def get_play_store(data):
    play = data.setdefault("_play", {})
    play.setdefault("wallets", {})
    play.setdefault("sessions", {})
    play.setdefault("transactions", [])
    play.setdefault("sites", [])
    for username in PLAY_USERS:
        play["wallets"].setdefault(username, 0)
    return play

def public_wallet(play, username):
    session = play["sessions"].get(username)
    balance = max(0, int(play["wallets"].get(username, 0)))
    if session and session.get("status") == "active":
        elapsed = max(0, int(time.time() - session["started_at"]))
        remaining = max(0, balance - elapsed)
        if remaining == 0:
            session.update(status="expired", ended_at=int(time.time()), consumed_seconds=balance)
            play["wallets"][username] = 0
        return {"balanceSeconds": remaining, "session": session}
    return {"balanceSeconds": balance, "session": None}

def validate_public_url(value):
    parsed = urlparse(value)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="URL phải bắt đầu bằng http:// hoặc https://")
    if parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
        raise HTTPException(status_code=400, detail="Không cho phép địa chỉ nội bộ")
    return value

@app.get("/api/play/wallet")
def get_play_wallet(username: str = Depends(require_student)):
    with DATA_LOCK:
        data = load_data()
        play = get_play_store(data)
        result = public_wallet(play, username)
        save_data(data)
        return result

@app.post("/api/play/reward")
def add_play_reward(payload: PlayReward, username: str = Depends(require_student)):
    if payload.minutes < 1 or payload.minutes > 240:
        raise HTTPException(status_code=400, detail="Số phút thưởng không hợp lệ")
    with DATA_LOCK:
        data = load_data()
        play = get_play_store(data)
        play["wallets"][username] += payload.minutes * 60
        play["transactions"].insert(0, {"id": str(uuid.uuid4()), "username": username, "seconds": payload.minutes * 60, "type": "spin", "note": payload.reward_name, "created_at": int(time.time())})
        save_data(data)
        return public_wallet(play, username)

@app.get("/api/play/sites")
def get_game_sites(username: str = Depends(require_student)):
    data = load_data()
    play = get_play_store(data)
    return [site for site in play["sites"] if site.get("enabled", True) and username in site.get("allowed_for", list(PLAY_USERS))]

@app.post("/api/play/sessions/start")
def start_play_session(payload: PlaySessionStart, username: str = Depends(require_student)):
    with DATA_LOCK:
        data = load_data()
        play = get_play_store(data)
        wallet = public_wallet(play, username)
        site = next((item for item in play["sites"] if item.get("id") == payload.site_id and item.get("enabled", True) and username in item.get("allowed_for", list(PLAY_USERS))), None)
        if not site:
            raise HTTPException(status_code=404, detail="Trò chơi không được phép")
        if wallet["balanceSeconds"] <= 0:
            raise HTTPException(status_code=403, detail="Đã hết thời gian chơi")
        session = wallet.get("session")
        if not session:
            session = {"id": str(uuid.uuid4()), "site_id": site["id"], "started_at": int(time.time()), "status": "active"}
            play["sessions"][username] = session
        else:
            session["site_id"] = site["id"]
        save_data(data)
        return {**public_wallet(play, username), "site": site}

@app.post("/api/play/sessions/stop")
def stop_play_session(username: str = Depends(require_student)):
    with DATA_LOCK:
        data = load_data()
        play = get_play_store(data)
        session = play["sessions"].get(username)
        if session and session.get("status") == "active":
            balance = int(play["wallets"].get(username, 0))
            consumed = min(balance, max(0, int(time.time() - session["started_at"])))
            play["wallets"][username] = balance - consumed
            session.update(status="stopped", ended_at=int(time.time()), consumed_seconds=consumed)
            play["transactions"].insert(0, {"id": str(uuid.uuid4()), "username": username, "seconds": -consumed, "type": "session", "note": "Phiên chơi game", "created_at": int(time.time())})
        save_data(data)
        return public_wallet(play, username)

@app.get("/api/parent/play")
def parent_play_data(_: bool = Depends(verify_parent_token)):
    with DATA_LOCK:
        data = load_data()
        play = get_play_store(data)
        wallets = {username: public_wallet(play, username) for username in PLAY_USERS}
        save_data(data)
        return {"wallets": wallets, "sites": play["sites"], "transactions": play["transactions"][:100]}

@app.put("/api/parent/play/sites")
def save_game_sites(sites: list[GameSiteInput], _: bool = Depends(verify_parent_token)):
    cleaned = []
    for site in sites:
        name = site.name.strip()
        url = site.url.strip()
        if not name and not url:
            continue
        if not name or not url:
            raise HTTPException(status_code=400, detail="Mỗi website cần có đủ tên và URL")
        if site.open_mode not in {"external", "kiosk", "iframe"}:
            raise HTTPException(status_code=400, detail="Chế độ mở website không hợp lệ")
        validate_public_url(url)
        allowed = [item for item in site.allowed_for if item in PLAY_USERS]
        site_data = site.model_dump() if hasattr(site, "model_dump") else site.dict()
        cleaned.append({**site_data, "id": site.id or str(uuid.uuid4()), "name": name, "url": url, "open_mode": "kiosk" if site.open_mode == "external" else site.open_mode, "allowed_for": allowed or list(PLAY_USERS)})
    with DATA_LOCK:
        data = load_data()
        play = get_play_store(data)
        play["sites"] = cleaned
        save_data(data)
    return cleaned

@app.post("/api/parent/play/adjust")
def adjust_play_time(payload: TimeAdjustment, _: bool = Depends(verify_parent_token)):
    if payload.username not in PLAY_USERS or abs(payload.minutes) > 1440:
        raise HTTPException(status_code=400, detail="Điều chỉnh không hợp lệ")
    with DATA_LOCK:
        data = load_data()
        play = get_play_store(data)
        play["wallets"][payload.username] = max(0, int(play["wallets"].get(payload.username, 0)) + payload.minutes * 60)
        play["transactions"].insert(0, {"id": str(uuid.uuid4()), "username": payload.username, "seconds": payload.minutes * 60, "type": "parent_adjust", "note": payload.note, "created_at": int(time.time())})
        save_data(data)
        return public_wallet(play, payload.username)

@app.get("/api/sync/{username}")
def get_sync_data(username: str):
    data = load_data()
    return data.get(username, {})

@app.post("/api/sync/{username}")
async def post_sync_data(username: str, request: Request):
    payload = await request.json()
    data = load_data()
    existing = data.get(username, {})
    if not isinstance(existing, dict):
        existing = {}
    existing.update(payload)
    data[username] = existing
    save_data(data)
    return {"status": "success"}

