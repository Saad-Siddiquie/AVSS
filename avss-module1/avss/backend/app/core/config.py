from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central application settings.
    Values are loaded from environment variables / .env file.
    """

    APP_NAME: str = "AVSS"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    POSTGRES_USER: str = "avss_user"
    POSTGRES_PASSWORD: str = "avss_password"
    POSTGRES_DB: str = "avss_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = (
        "postgresql://avss_user:avss_password@localhost:5432/avss_db"
    )

    SECRET_KEY: str = "change_this_to_a_long_random_string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    FRONTEND_ORIGIN: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
