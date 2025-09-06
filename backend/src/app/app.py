from __future__ import annotations
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from config.settings import get_settings

# Import routers and middleware
from app.routers.financial_market import router as financial_market_router
from app.routers.financial_analysis import router as financial_analysis_router
from app.routers.financial_ws import router as websocket_router
from app.middleware import ErrorHandlingMiddleware
from app.schemas import APIResponse

settings = get_settings()
app = FastAPI(
    title="stock-analysis-platform",
    description="stock-analysis-platform API: real-time market data, predictions, and AI insights",
    version="0.1.0",
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
