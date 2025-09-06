"""
Centralized middleware for error handling, logging, and standardization.
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
import time
import traceback
from datetime import datetime
from app.schemas import APIResponse
import logging

logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for centralized error handling, logging, and response standardization."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.time()

        # Log incoming request
        logger.info(f"→ {request.method} {request.url.path}")

        try:
            response = await call_next(request)

            # Log successful requests
            process_time = time.time() - start_time
            logger.info(
                f"{request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s"
            )

            return response

        except HTTPException as exc:
            process_time = time.time() - start_time
            logger.warning(
                f"{request.method} {request.url.path} - {exc.status_code} - {exc.detail} - {process_time:.3f}s"
            )
            error_response = APIResponse(
                success=False,
                message=exc.detail,
                data={
                    "error_type": "HTTPException",
                    "status_code": exc.status_code,
                    "path": str(request.url.path),
                    "method": request.method,
                },
                timestamp=datetime.utcnow(),
            )
            return JSONResponse(status_code=exc.status_code, content=error_response.dict())

        except Exception as exc:
            process_time = time.time() - start_time
            logger.error(
                f"{request.method} {request.url.path} - 500 - {str(exc)} - {process_time:.3f}s"
            )
            logger.error(f"Traceback: {traceback.format_exc()}")

            error_message = "Internal server error"
            error_type = exc.__class__.__name__ if hasattr(exc, "__class__") else "UnknownError"
            error_response = APIResponse(
                success=False,
                message=error_message,
                data={
                    "error_type": error_type,
                    "status_code": 500,
                    "path": str(request.url.path),
                    "method": request.method,
                },
                timestamp=datetime.utcnow(),
            )
            return JSONResponse(status_code=500, content=error_response.dict())
