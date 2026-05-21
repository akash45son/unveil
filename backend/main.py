import os
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from routes.auth import router as auth_router
from routes.predict import router as predict_router

load_dotenv()

app = FastAPI(title="Unveil API", description="Deepfake Detection API")
app.state.model_loaded = False
app.state.db = None
app.state.mongo_client = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth")
app.include_router(predict_router, prefix="/predict")


async def _download_model_if_needed() -> None:
    if os.path.exists(MODEL_PATH):
        return

    model_url = os.getenv("MODEL_URL")
    if not model_url:
        raise RuntimeError("MODEL_URL is not configured and model.pth is missing")

    response = requests.get(model_url, stream=True, timeout=120)
    response.raise_for_status()

    Path(MODEL_PATH).parent.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as model_file:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                model_file.write(chunk)


@app.on_event("startup")
async def startup_event():
    mongo_uri = os.getenv("MONGODB_URI")
    if mongo_uri:
        client = AsyncIOMotorClient(mongo_uri)
        app.state.mongo_client = client
        app.state.db = client["unveil"]


@app.on_event("shutdown")
async def shutdown_event():
    client = getattr(app.state, "mongo_client", None)
    if client is not None:
        client.close()


@app.get("/")
async def root():
    return {"message": "Unveil API is running", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": bool(getattr(app.state, "model_loaded", False))}
