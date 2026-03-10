"""
User model - System users with authentication and roles
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class UserRole(str, enum.Enum):
    """User role definitions"""
    ADMIN = "ADMIN"
    WAREHOUSE_MANAGER = "WAREHOUSE_MANAGER"
    WAREHOUSE_STAFF = "WAREHOUSE_STAFF"
    SALES_STAFF = "SALES_STAFF"
    DELIVERY_DRIVER = "DELIVERY_DRIVER"
    ACCOUNTANT = "ACCOUNTANT"


class User(Base):
    """User model for authentication and authorization"""
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    role = Column(Enum(UserRole, name='userrole', create_type=False), nullable=False, default=UserRole.WAREHOUSE_STAFF)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    
    phone = Column(String(20), nullable=True)
    employee_id = Column(String(50), nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
    
    def __repr__(self):
        return f"<User {self.username} ({self.role})>"