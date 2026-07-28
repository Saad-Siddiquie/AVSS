from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.auth import UserCreate, UserRead, Token, RefreshRequest, LogoutRequest
from app.services import auth as auth_service
from app.utils import security
from datetime import datetime
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


@router.post("/auth/register", response_model=UserRead)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = auth_service.get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = auth_service.create_user(db, user_in)
    return user


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
        expires_at = datetime.utcfromtimestamp(exp) if isinstance(exp, (int, float)) else datetime.utcnow()
    except Exception:
        expires_at = datetime.utcnow()
    auth_service.persist_refresh_token(db, refresh_token, user, expires_at)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


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
