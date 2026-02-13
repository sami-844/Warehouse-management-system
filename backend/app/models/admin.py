"""Admin models — ActivityLog, CompanySettings"""
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_log"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    username = Column(String(50))
    action = Column(String(50), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(Integer)
    description = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())


class CompanySettings(Base):
    __tablename__ = "company_settings"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String(100), unique=True, nullable=False)
    setting_value = Column(Text)
    setting_type = Column(String(20), default='string')
    updated_by = Column(Integer)
    updated_at = Column(DateTime, server_default=func.now())
