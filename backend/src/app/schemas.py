"""
Common API schemas and response formats for consistent API design.
"""

from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime


class APIResponse(BaseModel):
    """Base response format for all API endpoints."""

    success: bool = True
    message: str = "OK"
    data: Optional[Dict[str, Any]] = None
    timestamp: datetime

    @classmethod
    def success_response(cls, data: Dict[str, Any], message: str = "OK"):
        return cls(success=True, message=message, data=data, timestamp=datetime.utcnow())

    @classmethod
    def error_response(cls, message: str, data: Optional[Dict[str, Any]] = None):
        return cls(success=False, message=message, data=data, timestamp=datetime.utcnow())
