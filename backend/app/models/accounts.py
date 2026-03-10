"""Chart of Accounts and Journal Entries"""
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base


class Account(Base):
    """Chart of Accounts — double-entry bookkeeping"""
    __tablename__ = 'accounts'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    account_type = Column(String(50), nullable=False)  # Asset, Liability, Equity, Income, Expense, COGS
    parent_id = Column(Integer, ForeignKey('accounts.id'), nullable=True)
    balance = Column(Numeric(14, 3), nullable=False, default=0)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class MoneyTransfer(Base):
    """Transfer between accounts"""
    __tablename__ = 'money_transfers'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    from_account_id = Column(Integer, ForeignKey('accounts.id'), nullable=False)
    to_account_id = Column(Integer, ForeignKey('accounts.id'), nullable=False)
    amount = Column(Numeric(14, 3), nullable=False)
    transfer_date = Column(DateTime(timezone=True), nullable=False)
    reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(Integer, nullable=True)
