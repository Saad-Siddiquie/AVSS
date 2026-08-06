import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine

# ── Ensure all ORM models are imported before create_all ─────────────────────
import app.models.user
import app.models.refresh_token
import app.models.person
import app.models.camera

# ── API routers ───────────────────────────────────────────────────────────────
from app.api import health
from app.api import auth as auth_api
from app.api import cameras as cameras_api
from app.api import video as video_api
from app.api import detection as detection_api
from app.api import recognition as recognition_api
from app.api import persons as persons_api
from app.api import search as search_api

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    Runs startup logic before the server accepts requests,
    and teardown logic when the server shuts down.
    """
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)

    logger.info("Loading AI models...")
    from app.ai.loader import load_all_models
    load_all_models()

    yield  # Server is running

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("AVSS API shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "AI-powered Autonomous Video Surveillance System (AVSS). "
        "Detects, recognises, and tracks persons across CCTV/IP camera feeds."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(health.router,      prefix=settings.API_PREFIX)
app.include_router(auth_api.router,    prefix=settings.API_PREFIX)
app.include_router(cameras_api.router, prefix=settings.API_PREFIX)
app.include_router(video_api.router,   prefix=settings.API_PREFIX)
app.include_router(detection_api.router, prefix=settings.API_PREFIX)
app.include_router(recognition_api.router, prefix=settings.API_PREFIX)
app.include_router(persons_api.router, prefix=settings.API_PREFIX)
app.include_router(search_api.router,  prefix=settings.API_PREFIX)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "AVSS API is running",
        "docs": "/docs",
        "version": "0.1.0",
    }
