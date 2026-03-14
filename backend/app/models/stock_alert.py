"""Stock Alerts model — Phase 42"""
from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from app.core.database import Base
from datetime import datetime


class StockAlert(Base):
    __tablename__ = 'stock_alerts'

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, nullable=True)
    product_name = Column(Text, nullable=True)
    sku = Column(String(100), nullable=True)
    alert_type = Column(String(50), nullable=True)
    current_stock = Column(Float, default=0)
    reorder_level = Column(Float, default=0)
    minimum_stock = Column(Float, default=0)
    auto_po_id = Column(Integer, nullable=True)
    status = Column(String(50), default='active')
    acknowledged_by = Column(Integer, nullable=True)
    acknowledged_at = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
