"""Role and UserActivityLog models — Phase 37 Roles & Permissions"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class Role(Base):
    """
    Stores permission configuration for each role.
    Role.name matches UserRole enum values (ADMIN, WAREHOUSE_MANAGER, etc.)
    """
    __tablename__ = "roles"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    is_active = Column(Boolean, default=True, nullable=False)
    role_type = Column(String(20), default="system")
    permissions_json = Column(Text, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<Role {self.name}>"


class UserActivityLog(Base):
    """
    Granular user activity tracking for the admin panel.
    Separate from activity_log which tracks entity CRUD operations.
    """
    __tablename__ = "user_activity_log"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    username = Column(String(200))
    action = Column(String(200), nullable=False)
    module = Column(String(100))
    detail = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
