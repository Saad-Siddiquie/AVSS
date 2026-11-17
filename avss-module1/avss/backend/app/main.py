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
from app.api import stats as stats_api
from app.api import gallery as gallery_api
from app.api import alerts as alerts_api
from app.api import settings as settings_api
from app.api import live_cam as live_cam_api

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

    # ── Supabase Storage — ensure bucket exists ───────────────────────────
    try:
        from app.services.supabase_storage import ensure_bucket_exists
        from app.core.config import settings as _s
        if _s.supabase_enabled:
            ok = ensure_bucket_exists()
            if ok:
                logger.info("[✓] Supabase Storage bucket ready: %s", _s.SUPABASE_STORAGE_BUCKET)
        else:
            logger.info("[!] Supabase not configured — videos stored locally only.")
    except Exception as e:
        logger.warning("Supabase init warning: %s", e)

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
app.include_router(stats_api.router,     prefix=settings.API_PREFIX)
app.include_router(gallery_api.router,   prefix=settings.API_PREFIX)
app.include_router(alerts_api.router,    prefix=settings.API_PREFIX)
app.include_router(settings_api.router,  prefix=settings.API_PREFIX)
app.include_router(live_cam_api.router,  prefix=settings.API_PREFIX)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "AVSS API is running",
        "docs": "/docs",
        "version": "1.0.0",
        "routes": {
            "auth":     ["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/me", "/api/v1/auth/setup-admin"],
            "cameras":  ["/api/v1/cameras"],
            "pipeline": ["/api/v1/pipeline/process/upload", "/api/v1/pipeline/process/camera",
                         "/api/v1/pipeline/jobs", "/api/v1/pipeline/search",
                         "/api/v1/pipeline/search/all", "/api/v1/pipeline/video/{filename}"],
            "stats":    ["/api/v1/stats"],
            "gallery":  ["/api/v1/gallery", "/api/v1/gallery/{job_id}"],
            "alerts":   ["/api/v1/alerts", "/api/v1/alerts/{id}/read", "/api/v1/alerts/read-all"],
            "settings": ["/api/v1/settings", "/api/v1/settings/status"],
            "admin":    ["/api/v1/admin/users"],
            "health":   ["/api/v1/health"],
        },
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
