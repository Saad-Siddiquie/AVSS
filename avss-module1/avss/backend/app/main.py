from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
import logging

from app.api import health
from app.api import auth as auth_api
from app.api import cameras as cameras_api
from app.api import module5 as module5_api
from app.api import module6 as module6_api
from app.api import module7 as module7_api
from app.api import module8 as module8_api
from app.api import module9 as module9_api
from app.core.database import Base, engine
import app.models.user          # ensure models are registered with SQLAlchemy metadata
import app.models.refresh_token  # ensure refresh token model is registered
import app.models.person         # ensure person model is registered
import app.models.camera         # ensure camera model is registered

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered Autonomous Video Surveillance System (AVSS) for missing persons detection.",
    version="0.1.0",
)

# CORS - allows the Next.js frontend to call this API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(auth_api.router, prefix=settings.API_PREFIX)
app.include_router(cameras_api.router, prefix=settings.API_PREFIX)
app.include_router(module5_api.router, prefix=settings.API_PREFIX)
app.include_router(module6_api.router, prefix=settings.API_PREFIX)
app.include_router(module7_api.router, prefix=settings.API_PREFIX)
app.include_router(module8_api.router, prefix=settings.API_PREFIX)
app.include_router(module9_api.router, prefix=settings.API_PREFIX)


# Create DB tables on startup (simple approach for development)
Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {
        "message": "AVSS API is running",
        "docs": "/docs",
    }
