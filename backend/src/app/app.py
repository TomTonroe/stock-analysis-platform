from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.middleware import ErrorHandlingMiddleware
from app.routers.admin import router as admin_router
from app.routers.chat import router as chat_router
from app.routers.financial_analysis import router as financial_analysis_router
from app.routers.financial_market import router as financial_market_router
from app.routers.financial_ws import router as websocket_router
from app.schemas import APIResponse
from config.settings import get_settings
from database.connection import SessionLocal
from database.models import ChatMessage, ChatSession, SentimentAnalysisCache, StockDataCache

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App lifespan: clear DB on startup if enabled, then yield."""
    # Use uvicorn logger so messages show in console
    logger = logging.getLogger("uvicorn.error")
    if getattr(settings, "clear_db_on_startup", False):
        db = SessionLocal()
        try:
            cm = db.query(ChatMessage).count()
            cs = db.query(ChatSession).count()
            sc = db.query(StockDataCache).count()
            se = db.query(SentimentAnalysisCache).count()
            logger.info(
                "Startup DB state: chat_messages=%s, chat_sessions=%s, stock_cache=%s, sentiment_cache=%s",
                cm,
                cs,
                sc,
                se,
            )
            logger.info("Clearing database tables on startup...")
            db.query(ChatMessage).delete(synchronize_session=False)
            db.query(ChatSession).delete(synchronize_session=False)
            db.query(StockDataCache).delete(synchronize_session=False)
            db.query(SentimentAnalysisCache).delete(synchronize_session=False)
            db.commit()
            logger.info("Database cleared.")
        except Exception as e:
            db.rollback()
            logger.error("Failed to clear database on startup: %s", e)
        finally:
            db.close()
    yield


app = FastAPI(
    title="stock-analysis-platform",
    description="stock-analysis-platform API: real-time market data, predictions, and AI insights",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration from settings (comma-separated) or sensible defaults
cors_env = (
    getattr(settings, "cors_allowed_origins", None) or os.environ.get("CORS_ALLOWED_ORIGINS", "")
).strip()
if cors_env:
    allowed_origins = [o.strip() for o in cors_env.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

# Add middleware
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(financial_market_router)
app.include_router(financial_analysis_router)
app.include_router(websocket_router)
app.include_router(chat_router)
app.include_router(admin_router)

logger = logging.getLogger(__name__)


@app.get("/", include_in_schema=False)
async def root_redirect():
    """Redirect root to Next.js frontend."""
    # Prefer first allowed origin if configured, otherwise fallback to localhost
    target = allowed_origins[0] if allowed_origins else "http://localhost:3000"
    return RedirectResponse(url=target)


@app.get("/health", response_model=APIResponse)
async def health():
    """Health check endpoint."""
    return APIResponse.success_response(
        data={"status": "healthy", "env": settings.env},
        message="stock-analysis-platform API is running",
    )
