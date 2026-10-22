"""
AVSS — Autonomous Video Surveillance System
Core workflow:
  1. Register camera (RTSP/webcam) OR upload video footage
  2. System automatically detects all faces + generates embeddings
  3. User uploads a query photo of the target person
  4. System finds matching person in the video via FAISS
  5. Returns annotated video with ByteTrack bounding box + timestamps
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine

# ── ORM models (must be imported before create_all) ──────────────────────────
import app.models.user
import app.models.refresh_token
import app.models.camera
import app.models.video_job
import app.models.detection_log
import app.models.search_query

# ── API routers ───────────────────────────────────────────────────────────────
from app.api import health
from app.api import auth as auth_api
from app.api import cameras as cameras_api
from app.api import pipeline as pipeline_api

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("Creating / verifying database tables...")
    try:
        from app.core.database import ensure_schema
        ensure_schema(Base)
    except Exception as e:
        logger.error("Database setup failed: %s", e)
        raise

    logger.info("Loading AI models (wildtrack_best.pt → yolov8n-face → ArcFace → ByteTrack)...")
    try:
        from app.ai.loader import load_all_models
        load_all_models()
    except Exception as e:
        logger.error("AI model loading error: %s", e)

    yield

    logger.info("AVSS shutting down.")


app = FastAPI(
    title="AVSS — Autonomous Video Surveillance System",
    description="Upload video → embed all faces → upload query photo → find & track person.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_ORIGIN,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(health.router,        prefix=settings.API_PREFIX)
app.include_router(auth_api.router,      prefix=settings.API_PREFIX)
app.include_router(cameras_api.router,   prefix=settings.API_PREFIX)
app.include_router(pipeline_api.router,  prefix=settings.API_PREFIX)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "AVSS API is running",
        "docs": "/docs",
        "version": "1.0.0",
        "workflow": [
            "POST /api/v1/pipeline/process/upload  — Upload video",
            "POST /api/v1/pipeline/process/camera  — Use registered camera",
            "GET  /api/v1/pipeline/jobs/{id}        — Poll processing status",
            "POST /api/v1/pipeline/search           — Upload query photo",
            "GET  /api/v1/pipeline/search/{id}      — Poll search status",
            "GET  /api/v1/pipeline/video/{file}     — Stream annotated video",
        ],
    }


@app.get("/api/v1/debug/tables", tags=["Debug"])
def debug_tables():
    """Verify all DB tables and columns exist correctly."""
    from sqlalchemy import inspect
    inspector = inspect(engine)
    return {
        table: [col["name"] for col in inspector.get_columns(table)]
        for table in inspector.get_table_names()
    }
