from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import health
from app.api import auth as auth_api
from app.core.database import Base, engine
import app.models.user  # ensure models are registered with SQLAlchemy metadata
import app.models.refresh_token  # ensure refresh token model is registered

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


# Create DB tables on startup (simple approach for development)
Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {
        "message": "AVSS API is running",
        "docs": "/docs",
    }
