"""
Main FastAPI Application - Warehouse Management System
Entry point for the backend API
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base

# Import all models to ensure they're registered with Base
from app.models import (
    User, Product, ProductCategory, 
    Supplier, Customer, 
    Warehouse, InventoryTransaction, StockLevel
)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Wholesale Distribution Management System for AK Al Momaiza Trading",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """
    Initialize database tables on startup
    In production, use Alembic migrations instead
    """
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"📊 Database: {settings.DATABASE_URL}")
    
    # Create all tables (for development only)
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created/verified")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("👋 Shutting down Warehouse Management System")


@app.get("/")
async def root():
    """Root endpoint - API health check"""
    return {
        "message": "Ak Al Momaiza - Warehouse Management System",
        "Company": "Ak Al Momaiza Trading",
        "version": settings.APP_VERSION,
        "status": "online",
        "docs": "/api/docs"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "company": settings.COMPANY_NAME
    }


# Import and include routers
from app.api import auth, products

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(products.router, prefix="/api", tags=["Products"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes (development only)
        log_level="info"
    )
