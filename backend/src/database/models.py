from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text, Index
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

