from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME:  str  = "AVSS"
    APP_ENV:   str  = "development"
    DEBUG:     bool = True
    API_PREFIX: str = "/api/v1"

    # ── Database (Supabase PostgreSQL or local SQLite) ───────────────────────
    DATABASE_URL: str = "sqlite:///./avss_dev.db"

    # ── Supabase ─────────────────────────────────────────────────────────────
    SUPABASE_URL:              Optional[str] = None
    SUPABASE_ANON_KEY:         Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET:   str = "avss-videos"

    # ── JWT Auth ─────────────────────────────────────────────────────────────
    SECRET_KEY:                    str = "change_this_to_a_long_random_string"
    ALGORITHM:                     str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES:   int = 1440

    FRONTEND_ORIGIN: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_ROLE_KEY)


settings = Settings()
