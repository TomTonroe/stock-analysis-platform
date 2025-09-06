from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Loaded from .env; defaults keep only the essentials required for this app."""

    # Application
    app_name: str = "stock-analysis-platform"
    env: str = "dev"
    log_level: str = "INFO"

    # Project (legacy-compatible; safe defaults)
    project_name: str = "financial_stocks"
    project_data_path: str = "data/stocks/"

    # Database
    database_url: str = "sqlite:///stock-analysis-platform.db"

    # API / UI URLs
    api_url: str = "http://localhost:8000"

    # LLM provider
    llm_provider: str = "mock"  # or "openrouter"
    openrouter_api_key: Optional[str] = None

    # Financial
    market_data_cache_ttl: int = 300
    stock_data_path: str = "data/stocks/"
    default_stock_period: str = "2y"
    default_forecast_days: int = 30
    news_api_key: Optional[str] = None

    # CORS (comma-separated origins)
    cors_allowed_origins: Optional[str] = None

    class Config:
        env_file = "../.env"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields like NEXT_PUBLIC_* variables


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
