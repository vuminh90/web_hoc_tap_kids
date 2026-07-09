from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
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

@app.get("/")
def read_root():
    return {"message": "Learning API is running!"}

@app.get("/users/")
def get_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

import json
import os
from fastapi import Request

DATA_FILE = "data_store.json"

def load_data():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except:
            return {}

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.get("/api/sync/{username}")
def get_sync_data(username: str):
    data = load_data()
    return data.get(username, {})

@app.post("/api/sync/{username}")
async def post_sync_data(username: str, request: Request):
    payload = await request.json()
    data = load_data()
    data[username] = payload
    save_data(data)
    return {"status": "success"}

