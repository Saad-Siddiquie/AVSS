from fastapi import Depends, HTTPException, status

from app.api.auth import get_user_from_token


def require_roles(*roles: str):
    def role_checker(current_user=Depends(get_user_from_token)):
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient privileges")
        return current_user

    return role_checker
