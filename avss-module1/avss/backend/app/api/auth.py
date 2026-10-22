from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Optional

from app.core.config import settings
from app.core.database import get_db
from app.schemas.auth import UserCreate, UserRead, Token, RefreshRequest, LogoutRequest
from app.services import auth as auth_service
from app.utils import security
from datetime import datetime, timezone
from fastapi.security import OAuth2PasswordBearer


router = APIRouter(tags=["Auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/login")


def get_user_from_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = security.decode_token(token)
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except Exception:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    user = auth_service.get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/auth/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = auth_service.get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    # Prevent self-assigning admin role via public register
    safe_in = user_in.model_copy(update={"role": "user"})
    user = auth_service.create_user(db, safe_in)
    access_token, refresh_token = auth_service.create_tokens_for_user(user)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/auth/login", response_model=Token)
async def login(request: Request, db: Session = Depends(get_db)):
    email = None
    password = None

    if request.headers.get("content-type", "").startswith("application/json"):
        body = await request.json()
        email = body.get("email")
        password = body.get("password")
    else:
        form = await request.form()
        email = form.get("username") or form.get("email")
        password = form.get("password")

    if not email or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email and password are required")

    user = auth_service.authenticate_user(db, email, password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    access_token, refresh_token = auth_service.create_tokens_for_user(user)
    try:
        payload = security.decode_token(refresh_token)
        exp = payload.get("exp")
        expires_at = datetime.utcfromtimestamp(exp) if isinstance(exp, (int, float)) else datetime.now(timezone.utc).replace(tzinfo=None)
    except Exception:
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None)
    auth_service.persist_refresh_token(db, refresh_token, user, expires_at)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/auth/me", response_model=UserRead)
def read_me(current_user=Depends(get_user_from_token)):
    return current_user


@router.post("/auth/refresh", response_model=Token)
async def refresh_tokens(request: Request, db: Session = Depends(get_db)):
    # Accept either JSON {"refresh_token": "..."} or form data (refresh_token or token)
    refresh_token = None
    ct = request.headers.get("content-type", "")
    if ct.startswith("application/json"):
        body = await request.json()
        refresh_token = body.get("refresh_token") or body.get("token")
    else:
        form = await request.form()
        refresh_token = form.get("refresh_token") or form.get("token")

    if not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token is required")

    rt = auth_service.get_refresh_token(db, refresh_token)
    if not rt:
        raise HTTPException(status_code=401, detail="Invalid or revoked refresh token")
    if rt.is_expired():
        raise HTTPException(status_code=401, detail="Refresh token expired")
    # Issue new access token
    user = rt.user
    access = security.create_access_token(subject=user.email)
    return {"access_token": access, "refresh_token": refresh_token, "token_type": "bearer"}


@router.post("/auth/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    # Accept either JSON {"refresh_token": "..."} or form data
    refresh_token = None
    ct = request.headers.get("content-type", "")
    if ct.startswith("application/json"):
        body = await request.json()
        refresh_token = body.get("refresh_token") or body.get("token")
    else:
        form = await request.form()
        refresh_token = form.get("refresh_token") or form.get("token")

    if not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token is required")

    ok = auth_service.revoke_refresh_token(db, refresh_token)
    if not ok:
        raise HTTPException(status_code=400, detail="Refresh token not found")
    return {"status": "logged_out"}


# ── Admin-only helpers ────────────────────────────────────────────────────────

def require_admin(current_user=Depends(get_user_from_token)):
    """Dependency: raises 403 if caller is not admin/superuser."""
    if current_user.role != "admin" and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user


@router.get("/admin/users", response_model=list[UserRead], tags=["Admin"])
def admin_list_users(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: list every user account."""
    from app.models.user import User as UserModel
    return db.query(UserModel).order_by(UserModel.id).all()


@router.patch("/admin/users/{user_id}", response_model=UserRead, tags=["Admin"])
def admin_update_user(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: change a user's role or active status."""
    from app.models.user import User as UserModel
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    allowed = {"role", "is_active", "full_name"}
    for key, val in payload.items():
        if key in allowed:
            setattr(user, key, val)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/admin/users/{user_id}", tags=["Admin"])
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    """Admin: delete a user account (cannot delete yourself)."""
    from app.models.user import User as UserModel
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    db.delete(user)
    db.commit()
    return {"status": "deleted", "user_id": user_id}


@router.post("/admin/users", response_model=UserRead, tags=["Admin"])
def admin_create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: create a user with any role (including admin)."""
    existing = auth_service.get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")
    return auth_service.create_user(db, user_in)


# ── First-run: seed the first admin account (no auth required) ───────────────

from pydantic import BaseModel


class SeedAdminRequest(BaseModel):
    full_name: str
    email: str
    password: str


@router.post(
    "/auth/setup-admin",
    tags=["Auth"],
    summary="Create the first admin account (only works when no admin exists)",
)
def setup_first_admin(body: SeedAdminRequest, db: Session = Depends(get_db)):
    """
    One-time endpoint to create the first admin account.
    Returns 409 if an admin account already exists — prevents abuse.
    """
    from app.models.user import User as UserModel

    # Block if any admin already exists
    existing_admin = (
        db.query(UserModel)
        .filter((UserModel.role == "admin") | (UserModel.is_superuser == True))
        .first()
    )
    if existing_admin:
        raise HTTPException(
            status_code=409,
            detail="An admin account already exists. Use the admin panel to manage accounts.",
        )

    # Check email not taken
    if auth_service.get_user_by_email(db, body.email):
        raise HTTPException(status_code=400, detail="Email already registered.")

    from app.schemas.auth import UserCreate as UC
    user_in = UC(
        full_name=body.full_name,
        email=body.email,
        password=body.password,
        role="admin",
    )
    user = auth_service.create_user(db, user_in)
    # Also set is_superuser
    user.is_superuser = True
    db.commit()
    db.refresh(user)

    access_token, refresh_token = auth_service.create_tokens_for_user(user)
    return {
        "message": "Admin account created successfully.",
        "email": user.email,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }
