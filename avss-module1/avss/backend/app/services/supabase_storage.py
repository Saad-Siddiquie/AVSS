"""
Supabase Storage Service
Uploads annotated output videos to Supabase Storage and returns public URLs.

Storage layout:
  avss-videos/
    search-results/
      search_{query_id}_{timestamp}.mp4
    query-images/
      query_{query_id}_{timestamp}.jpg

Falls back gracefully if Supabase is not configured (uses local file path).
"""
import logging
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def _get_client():
    """Return a Supabase client or None if not configured."""
    from app.core.config import settings
    if not settings.supabase_enabled:
        return None, None
    try:
        from supabase import create_client
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        return client, settings.SUPABASE_STORAGE_BUCKET
    except ImportError:
        logger.warning("supabase-py not installed. Run: pip install supabase")
        return None, None
    except Exception as e:
        logger.error("Supabase client error: %s", e)
        return None, None


def upload_search_video(
    local_path: Path,
    query_id: int,
) -> Optional[str]:
    """
    Upload an annotated search result MP4 to Supabase Storage.

    Returns:
        Public URL of the uploaded video, or None if upload fails / Supabase not configured.
    """
    client, bucket = _get_client()
    if not client or not local_path.exists():
        logger.info("Supabase not configured or file missing — using local path.")
        return None

    ts   = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    dest = f"search-results/search_{query_id}_{ts}.mp4"

    try:
        with open(local_path, "rb") as f:
            data = f.read()

        response = client.storage.from_(bucket).upload(
            path=dest,
            file=data,
            file_options={"content-type": "video/mp4", "upsert": "true"},
        )
        logger.info("Uploaded video to Supabase: %s", dest)

        # Get public URL
        public_url = client.storage.from_(bucket).get_public_url(dest)
        logger.info("Public URL: %s", public_url)
        return public_url

    except Exception as e:
        logger.error("Supabase upload failed: %s", e)
        return None


def upload_query_image(
    local_path: Path,
    query_id: int,
) -> Optional[str]:
    """
    Upload the query (reference) face photo to Supabase Storage.

    Returns:
        Public URL of the uploaded image, or None on failure.
    """
    client, bucket = _get_client()
    if not client or not local_path.exists():
        return None

    ts      = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    suffix  = local_path.suffix or ".jpg"
    mime, _ = mimetypes.guess_type(str(local_path))
    dest    = f"query-images/query_{query_id}_{ts}{suffix}"

    try:
        with open(local_path, "rb") as f:
            data = f.read()

        client.storage.from_(bucket).upload(
            path=dest,
            file=data,
            file_options={"content-type": mime or "image/jpeg", "upsert": "true"},
        )

        public_url = client.storage.from_(bucket).get_public_url(dest)
        logger.info("Uploaded query image to Supabase: %s", public_url)
        return public_url

    except Exception as e:
        logger.error("Supabase image upload failed: %s", e)
        return None


def delete_video(storage_path: str) -> bool:
    """Delete a video from Supabase Storage by its storage path."""
    client, bucket = _get_client()
    if not client:
        return False
    try:
        client.storage.from_(bucket).remove([storage_path])
        return True
    except Exception as e:
        logger.error("Supabase delete failed: %s", e)
        return False


def ensure_bucket_exists() -> bool:
    """
    Create the storage bucket if it doesn't exist.
    Called once on startup.
    """
    client, bucket = _get_client()
    if not client:
        return False
    try:
        # List buckets — if ours exists, we're done
        buckets = client.storage.list_buckets()
        existing = [b.name for b in buckets]
        if bucket not in existing:
            client.storage.create_bucket(bucket, options={"public": True})
            logger.info("Created Supabase bucket: %s", bucket)
        else:
            logger.info("Supabase bucket exists: %s", bucket)
        return True
    except Exception as e:
        logger.warning("Could not verify Supabase bucket: %s", e)
        return False
