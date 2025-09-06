from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas import APIResponse
from database.models import StockDataCache, SentimentAnalysisCache, ChatSession, ChatMessage
from database import get_db

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/clear-all", response_model=APIResponse)
async def clear_all(db: Session = Depends(get_db)):
    cm = db.query(ChatMessage).count()
    cs = db.query(ChatSession).count()
    sc = db.query(StockDataCache).count()
    se = db.query(SentimentAnalysisCache).count()

    db.query(ChatMessage).delete(synchronize_session=False)
    db.query(ChatSession).delete(synchronize_session=False)
    db.query(StockDataCache).delete(synchronize_session=False)
    db.query(SentimentAnalysisCache).delete(synchronize_session=False)
    db.commit()

    return APIResponse.success_response(
        data={
            "before": {
                "chat_messages": cm,
                "chat_sessions": cs,
                "stock_cache": sc,
                "sentiment_cache": se,
            },
            "after": {
                "chat_messages": 0,
                "chat_sessions": 0,
                "stock_cache": 0,
                "sentiment_cache": 0,
            },
        },
        message="All tables cleared",
    )

