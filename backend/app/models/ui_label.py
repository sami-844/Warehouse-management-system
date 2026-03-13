"""UI Labels model — admin-editable navigation and page labels"""
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class UILabel(Base):
    __tablename__ = "ui_labels"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    label_key = Column(String(100), unique=True, nullable=False)
    label_value = Column(String(200), nullable=False)
    default_value = Column(String(200), nullable=False)
    group_name = Column(String(50), default='navigation')
    updated_by = Column(Integer)
    updated_at = Column(DateTime, server_default=func.now())
