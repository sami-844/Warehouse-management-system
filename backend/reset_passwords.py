"""
Password Reset Script
Run this ONCE to fix the login issue.
The original init_db.py hashed "admin" but displayed "admin123" as the password.
This script resets all passwords to match what's shown on the login page.

Usage: cd backend && python reset_passwords.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User


def reset_passwords():
    db = SessionLocal()
    try:
        passwords = {
            "admin": "admin123",
            "warehouse_mgr": "warehouse123",
            "sales1": "sales123",
            "driver1": "driver123",
        }

        for username, password in passwords.items():
            user = db.query(User).filter(User.username == username).first()
            if user:
                user.hashed_password = get_password_hash(password)
                print(f"✅ Reset password for '{username}' → '{password}'")
            else:
                print(f"⚠️  User '{username}' not found")

        db.commit()
        print("\n🎉 All passwords reset successfully!")
        print("\nYou can now login with:")
        print("  admin / admin123")
        print("  warehouse_mgr / warehouse123")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    reset_passwords()
