from datetime import timedelta, datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.auth import UserCreate
from app.utils.security import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, user_in: UserCreate) -> User:
    hashed = get_password_hash(user_in.password)
    user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        hashed_password=hashed,
        role=user_in.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_tokens_for_user(user: User) -> str:
    access = create_access_token(subject=user.email)
    refresh = create_refresh_token(subject=user.email)
    return access, refresh


def persist_refresh_token(db: Session, token: str, user: User, expires_at: datetime):
    rt = RefreshToken(token=token, user_id=user.id, expires_at=expires_at)
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return rt


def get_refresh_token(db: Session, token: str) -> Optional[RefreshToken]:
    return db.query(RefreshToken).filter(RefreshToken.token == token, RefreshToken.revoked == False).first()


def revoke_refresh_token(db: Session, token: str):
    rt = db.query(RefreshToken).filter(RefreshToken.token == token).first()
    if not rt:
        return False
    rt.revoked = True
    db.add(rt)
    db.commit()
    return True
