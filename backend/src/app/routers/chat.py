from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session

from database import get_db
from services.chat_service import ChatService
from llm.client import llm_client
from app.schemas import APIResponse


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatSessionRequest(BaseModel):
    ticker: str
    period: str
    sentiment_analysis_id: int


class ChatMessageRequest(BaseModel):
    session_id: str
    message: str


@router.post("/sessions", response_model=APIResponse)
async def create_chat_session(request: ChatSessionRequest, db: Session = Depends(get_db)):
    try:
        chat_service = ChatService(db, llm_client)
        session_id = chat_service.create_session(
            request.ticker, request.period, request.sentiment_analysis_id
        )
        return APIResponse.success_response(
            data={"session_id": session_id}, message="Chat session created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/message", response_model=APIResponse)
async def send_chat_message(request: ChatMessageRequest, db: Session = Depends(get_db)):
    try:
        chat_service = ChatService(db, llm_client)
        response = chat_service.process_chat_message(request.session_id, request.message)
        return APIResponse.success_response(data={"response": response}, message="Message processed")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/messages", response_model=APIResponse)
async def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    try:
        chat_service = ChatService(db, llm_client)
        messages = chat_service.get_conversation_history(session_id, limit=50)
        # Shape response for frontend
        payload = [
            {
                "id": m.id,
                "message_type": m.message_type,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]
        return APIResponse.success_response(data={"messages": payload}, message="History loaded")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

