import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class every ORM model inherits from."""
    pass


def get_db():
    """FastAPI dependency — yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection() -> bool:
    """Quick sanity check used by /health endpoint."""
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
        return True
    except Exception as e:
        logger.error("[DB CONNECTION ERROR] %s", e)
        return False


def ensure_schema(base) -> None:
    """
    Create all tables that don't exist yet.
    For SQLite development: if a column is missing from an existing table,
    drop and recreate it (acceptable because dev data is disposable).
    For PostgreSQL production: use Alembic migrations instead.
    """
    if "sqlite" not in settings.DATABASE_URL:
        # PostgreSQL — just create missing tables, don't touch existing ones
        base.metadata.create_all(bind=engine)
        logger.info("PostgreSQL: created any missing tables.")
        return

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table_name, table_obj in base.metadata.tables.items():
        if table_name not in existing_tables:
            # Table doesn't exist — create it
            table_obj.create(bind=engine)
            logger.info("Created table: %s", table_name)
            continue

        # Table exists — check if all columns are present
        existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
        model_cols = {col.name for col in table_obj.columns}
        missing = model_cols - existing_cols

        if missing:
            logger.warning(
                "Table '%s' is missing columns %s — dropping and recreating (SQLite dev mode).",
                table_name, missing,
            )
            with engine.begin() as conn:
                conn.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
            table_obj.create(bind=engine)
            logger.info("Recreated table: %s with columns: %s", table_name, model_cols)

    logger.info("Schema verification complete.")
