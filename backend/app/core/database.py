"""
Database connection and session management
Supports both SQLite (development) and PostgreSQL (production)
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Build engine kwargs based on database type
engine_kwargs = {}

if "sqlite" in settings.DATABASE_URL:
    # SQLite needs this for multi-threaded use
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL connection pool settings for production
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_pre_ping"] = True  # Verify connection is alive before using

# Create database engine
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    **engine_kwargs
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
Base = declarative_base()


def get_db():
    """
    Dependency function to get database session
    Usage: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
