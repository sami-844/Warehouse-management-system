"""
Warehouse model - Storage locations
"""

from sqlalchemy import Column, Integer, String, Boolean, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Warehouse(Base):
    """Warehouse locations - main warehouse with zones/sections"""
    __tablename__ = "warehouses"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    code = Column(String(20), unique=True, index=True)
    location = Column(String(200))
    address = Column(Text)
    manager_name = Column(String(100))
    contact_phone = Column(String(20))
    is_active = Column(Boolean, default=True)
    
    # Relationships
    stock_levels = relationship("StockLevel", back_populates="warehouse")
    transactions = relationship("InventoryTransaction", back_populates="warehouse")