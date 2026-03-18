"""
Authentication API endpoints
Login, logout, get current user, and change password
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, decode_access_token
from app.core.config import settings
from app.models.user import User
from app.schemas.user import User as UserSchema, Token, LoginRequest

router = APIRouter()

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Get current authenticated user from JWT token
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Decode token
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception

    # Get user from database
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Login endpoint - Returns JWT access token

    Use this token in the 'Authorization' header as: Bearer <token>
    """
    # Find user by username
    user = db.query(User).filter(User.username == form_data.username).first()

    # Verify user exists and password is correct
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Track login activity
    from datetime import datetime, timezone
    user.last_active_at = datetime.now(timezone.utc)
    user.login_count = (user.login_count or 0) + 1
    db.commit()

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value if hasattr(user.role, 'value') else user.role},
        expires_delta=access_token_expires
    )

    # Check if password change is required
    must_change = getattr(user, 'must_change_password', False) or False

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": must_change,
        "user_id": user.id,
        "username": user.username,
        "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
        "full_name": user.full_name or user.username,
    }


@router.get("/me", response_model=UserSchema)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current logged-in user information

    Requires authentication - must provide Bearer token
    """
    return current_user


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change current user's password with strength validation."""
    # Verify current password
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Password strength validation
    new_pw = request.new_password
    if len(new_pw) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if not any(c.isupper() for c in new_pw):
        raise HTTPException(400, "Password must contain at least one uppercase letter")
    if not any(c.islower() for c in new_pw):
        raise HTTPException(400, "Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in new_pw):
        raise HTTPException(400, "Password must contain at least one number")
    if new_pw == request.current_password:
        raise HTTPException(400, "New password must be different from current password")

    # Update password and clear the force-change flag
    current_user.hashed_password = get_password_hash(new_pw)
    try:
        current_user.must_change_password = False
    except Exception:
        pass  # Column might not exist yet

    db.commit()

    return {"message": "Password changed successfully"}


@router.post("/logout")
def logout():
    """
    Logout endpoint

    Note: With JWT tokens, logout is handled client-side by deleting the token.
    This endpoint is here for API completeness.
    """
    return {"message": "Successfully logged out. Please delete your token on the client side."}
