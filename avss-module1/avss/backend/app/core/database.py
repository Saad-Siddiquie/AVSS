from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class every ORM model (Users, Cameras, Persons, etc.) will inherit from."""
    pass


def get_db():
    """
    FastAPI dependency that yields a DB session per request
    and guarantees it's closed afterwards.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection() -> bool:
    """Quick sanity check used by /health endpoint to confirm PostgreSQL is reachable."""
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
        return True
    except Exception as e:
        print(f"[DB CONNECTION ERROR] {e}")
        return False
