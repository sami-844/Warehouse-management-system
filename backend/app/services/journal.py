"""
Auto-posting service — creates journal entries for every business event.

ACCOUNT CODES (from Chart of Accounts):
  1210  Accounts Receivable (Trade Debtors)
  1120  Bank Account — Main
  1110  Cash on Hand
  1310  Inventory / Goods for Resale
  2110  Accounts Payable (Trade Creditors)
  2210  VAT Payable
  1410  Input VAT Recoverable
  4110  Sales Revenue
  5100  Cost of Goods Sold
  6xxx  Expense accounts
"""

from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.accounts import JournalEntry, JournalEntryLine


def _next_entry_number(db: Session) -> str:
    year = date.today().year
    count = db.query(JournalEntry).filter(
        JournalEntry.entry_number.like(f"JE-{year}-%")
    ).count()
    return f"JE-{year}-{str(count + 1).zfill(4)}"


def post_sales_invoice(db: Session, invoice_id: int, customer_name: str,
                       subtotal: float, vat_amount: float, total: float,
                       created_by: int = None):
    """
    When a sales invoice is created:
      DR Accounts Receivable (1210)    total
      CR Sales Revenue        (4110)   subtotal
      CR VAT Payable          (2210)   vat_amount
    """
    entry = JournalEntry(
        entry_number=_next_entry_number(db),
        entry_date=date.today(),
        description=f"Sales invoice — {customer_name}",
        reference_type="SALES_INVOICE",
        reference_id=invoice_id,
        created_by=created_by,
    )
    db.add(entry)
    db.flush()

    lines = [
        JournalEntryLine(journal_entry_id=entry.id, account_code="1210",
                         account_name="Accounts Receivable",
                         debit_amount=Decimal(str(total)), credit_amount=0,
                         description=f"Invoice to {customer_name}"),
        JournalEntryLine(journal_entry_id=entry.id, account_code="4110",
                         account_name="Sales Revenue",
                         debit_amount=0, credit_amount=Decimal(str(subtotal)),
                         description="Product sales"),
    ]
    if vat_amount > 0:
        lines.append(
            JournalEntryLine(journal_entry_id=entry.id, account_code="2210",
                             account_name="VAT Payable",
                             debit_amount=0, credit_amount=Decimal(str(vat_amount)),
                             description="Output VAT 5%")
        )
    db.add_all(lines)
    db.commit()
    return entry


def post_sales_payment(db: Session, invoice_id: int, customer_name: str,
                       amount: float, payment_method: str, created_by: int = None):
    """
    When customer payment is received:
      DR Cash/Bank  (1110/1120)    amount
      CR Accounts Receivable (1210) amount
    """
    account_code = "1110" if payment_method == "cash" else "1120"
    account_name = "Cash on Hand" if payment_method == "cash" else "Bank Account"

    entry = JournalEntry(
        entry_number=_next_entry_number(db),
        entry_date=date.today(),
        description=f"Payment received — {customer_name}",
        reference_type="SALES_PAYMENT",
        reference_id=invoice_id,
        created_by=created_by,
    )
    db.add(entry)
    db.flush()

    db.add_all([
        JournalEntryLine(journal_entry_id=entry.id, account_code=account_code,
                         account_name=account_name,
                         debit_amount=Decimal(str(amount)), credit_amount=0),
        JournalEntryLine(journal_entry_id=entry.id, account_code="1210",
                         account_name="Accounts Receivable",
                         debit_amount=0, credit_amount=Decimal(str(amount))),
    ])
    db.commit()
    return entry


def post_purchase_invoice(db: Session, invoice_id: int, supplier_name: str,
                          subtotal: float, vat_amount: float, total: float,
                          created_by: int = None):
    """
    When a purchase invoice is recorded:
      DR Inventory / COGS  (1310)   subtotal
      DR VAT Recoverable   (1410)   vat_amount
      CR Accounts Payable  (2110)   total
    """
    entry = JournalEntry(
        entry_number=_next_entry_number(db),
        entry_date=date.today(),
        description=f"Purchase invoice — {supplier_name}",
        reference_type="PURCHASE_INVOICE",
        reference_id=invoice_id,
        created_by=created_by,
    )
    db.add(entry)
    db.flush()

    lines = [
        JournalEntryLine(journal_entry_id=entry.id, account_code="1310",
                         account_name="Inventory",
                         debit_amount=Decimal(str(subtotal)), credit_amount=0),
        JournalEntryLine(journal_entry_id=entry.id, account_code="2110",
                         account_name="Accounts Payable",
                         debit_amount=0, credit_amount=Decimal(str(total))),
    ]
    if vat_amount > 0:
        lines.append(
            JournalEntryLine(journal_entry_id=entry.id, account_code="1410",
                             account_name="Input VAT Recoverable",
                             debit_amount=Decimal(str(vat_amount)), credit_amount=0)
        )
    db.add_all(lines)
    db.commit()
    return entry


def post_purchase_payment(db: Session, invoice_id: int, supplier_name: str,
                          amount: float, payment_method: str, created_by: int = None):
    """
    When supplier is paid:
      DR Accounts Payable (2110)  amount
      CR Cash/Bank (1110/1120)    amount
    """
    account_code = "1110" if payment_method == "cash" else "1120"
    account_name = "Cash on Hand" if payment_method == "cash" else "Bank Account"

    entry = JournalEntry(
        entry_number=_next_entry_number(db),
        entry_date=date.today(),
        description=f"Payment to supplier — {supplier_name}",
        reference_type="PURCHASE_PAYMENT",
        reference_id=invoice_id,
        created_by=created_by,
    )
    db.add(entry)
    db.flush()

    db.add_all([
        JournalEntryLine(journal_entry_id=entry.id, account_code="2110",
                         account_name="Accounts Payable",
                         debit_amount=Decimal(str(amount)), credit_amount=0),
        JournalEntryLine(journal_entry_id=entry.id, account_code=account_code,
                         account_name=account_name,
                         debit_amount=0, credit_amount=Decimal(str(amount))),
    ])
    db.commit()
    return entry


def post_expense(db: Session, expense_id: int, description: str,
                 amount: float, expense_account: str, payment_method: str,
                 created_by: int = None):
    """
    When an expense is recorded:
      DR Expense account (6xxx)   amount
      CR Cash/Bank (1110/1120)    amount
    """
    account_code = "1110" if payment_method == "cash" else "1120"

    entry = JournalEntry(
        entry_number=_next_entry_number(db),
        entry_date=date.today(),
        description=f"Expense — {description}",
        reference_type="EXPENSE",
        reference_id=expense_id,
        created_by=created_by,
    )
    db.add(entry)
    db.flush()

    db.add_all([
        JournalEntryLine(journal_entry_id=entry.id, account_code=expense_account,
                         account_name=description,
                         debit_amount=Decimal(str(amount)), credit_amount=0),
        JournalEntryLine(journal_entry_id=entry.id, account_code=account_code,
                         account_name="Cash/Bank",
                         debit_amount=0, credit_amount=Decimal(str(amount))),
    ])
    db.commit()
    return entry
