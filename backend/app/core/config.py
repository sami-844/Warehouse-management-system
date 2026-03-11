"""
Configuration settings for Warehouse Management System
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "Warehouse Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "sqlite:///./warehouse.db"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8000"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Convert comma-separated CORS origins to list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Company Info
    COMPANY_NAME: str = "AK Al Mumayza Trading"
    COMPANY_ADDRESS: str = "Oman"
    COMPANY_PHONE: str = ""
    COMPANY_EMAIL: str = ""
    CURRENCY: str = "OMR"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
