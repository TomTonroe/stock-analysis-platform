from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text, Index, ForeignKey
from sqlalchemy.orm import relationship
from .connection import Base


class StockDataCache(Base):
    __tablename__ = "stock_data_cache"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), nullable=False, index=True)
    period = Column(String(10), nullable=False, index=True)
    data_type = Column(String(20), nullable=False, index=True)
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    data_points = Column(Integer)

    __table_args__ = (
        Index('idx_cache_lookup', 'ticker', 'period', 'data_type'),
        Index('idx_expires', 'expires_at'),
    )

    def __repr__(self):
        return f"<StockDataCache(ticker={self.ticker}, period={self.period}, type={self.data_type})>"


class SentimentAnalysisCache(Base):
    __tablename__ = "sentiment_cache"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), nullable=False, index=True)
    period = Column(String(10), nullable=False, index=True)
    model = Column(String(50), nullable=False, index=True)
    analysis_data = Column(JSON, nullable=False)
    analysis_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    confidence_score = Column(Float)
    processing_time_ms = Column(Float)

    __table_args__ = (
        Index('idx_sentiment_lookup', 'ticker', 'period', 'model'),
        Index('idx_sentiment_expires', 'expires_at'),
    )

    def __repr__(self):
        return f"<SentimentCache(ticker={self.ticker}, model={self.model})>"


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), unique=True, nullable=False, index=True)
    ticker = Column(String(20), nullable=False, index=True)
    period = Column(String(10), nullable=False)
    sentiment_analysis_id = Column(Integer, ForeignKey("sentiment_cache.id"))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    meta = Column('metadata', JSON)

    # Relationships
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    sentiment_analysis = relationship("SentimentAnalysisCache")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("chat_sessions.session_id"), nullable=False)
    message_type = Column(String(10), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    meta = Column('metadata', JSON)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")
