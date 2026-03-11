"""
Migration: Create bank_accounts table — Phase 28
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from app.core.database import engine


def run():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bank_accounts (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                account_name    VARCHAR(200) NOT NULL,
                account_type    VARCHAR(50) DEFAULT 'bank',
                bank_name       VARCHAR(200),
                account_number  VARCHAR(100),
                iban            VARCHAR(50),
                currency        VARCHAR(10) DEFAULT 'OMR',
                opening_balance NUMERIC(14,3) DEFAULT 0,
                current_balance NUMERIC(14,3) DEFAULT 0,
                is_default      BOOLEAN DEFAULT 0,
                is_active       BOOLEAN DEFAULT 1,
                notes           TEXT,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # Seed default accounts if table is empty
        count = conn.execute(text("SELECT COUNT(*) FROM bank_accounts")).fetchone()[0]
        if count == 0:
            conn.execute(text("""
                INSERT INTO bank_accounts (account_name, account_type, is_default, current_balance)
                VALUES ('Cash on Hand', 'cash', 1, 0)
            """))
            conn.execute(text("""
                INSERT INTO bank_accounts (account_name, account_type, bank_name, current_balance)
                VALUES ('Bank Account (Main)', 'bank', 'Bank Muscat', 0)
            """))
            print("Seeded 2 default bank accounts")

    print("bank_accounts table ready")


if __name__ == "__main__":
    run()
