"""Chart of Accounts, Journal Entries, and Bank Reconciliation"""
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey, Text
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


class JournalEntry(Base):
    """Double-entry journal entries — auto-created by transactions"""
    __tablename__ = 'journal_entries'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    entry_number = Column(String(50), unique=True)
    entry_date = Column(DateTime(timezone=True), nullable=False)
    description = Column(Text)
    reference_type = Column(String(50))
    reference_id = Column(Integer)
    created_by = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_posted = Column(String(10), default='posted')


class JournalEntryLine(Base):
    """Individual debit/credit lines within a journal entry"""
    __tablename__ = 'journal_entry_lines'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey('journal_entries.id'), nullable=False)
    account_code = Column(String(10), nullable=False)
    account_name = Column(String(200))
    debit_amount = Column(Numeric(14, 3), default=0)
    credit_amount = Column(Numeric(14, 3), default=0)
    description = Column(Text)


class BankReconciliation(Base):
    """Bank reconciliation sessions"""
    __tablename__ = 'bank_reconciliations'
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_date = Column(Date)
    bank_statement_date = Column(Date)
    opening_balance = Column(Numeric(14, 3), default=0)
    closing_balance = Column(Numeric(14, 3), default=0)
    status = Column(String(20), default='in_progress')
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
