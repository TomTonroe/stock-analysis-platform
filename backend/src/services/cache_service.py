"""
Cache service for financial data to improve performance and reduce external API calls.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from database import StockDataCache, SentimentAnalysisCache
from config.settings import get_settings

logger = logging.getLogger(__name__)


class FinancialCacheService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.cache_ttl = {
            'history': 1,
            'info': 4,
            'summary': 2,
            'summary_ext': 4,
            'sentiment': 6,
        }
    
    def get_stock_data(self, ticker: str, period: str, data_type: str) -> Optional[Dict[str, Any]]:
        try:
            cache_entry = self.db.query(StockDataCache).filter(
                StockDataCache.ticker == ticker.upper(),
                StockDataCache.period == period,
                StockDataCache.data_type == data_type,
                StockDataCache.expires_at > datetime.utcnow()
            ).first()
            if cache_entry:
                logger.debug("cache hit %s %s %s", ticker, period, data_type)
                return cache_entry.data
            else:
                logger.debug("cache miss %s %s %s", ticker, period, data_type)
                return None
        except Exception as e:
            logger.warning("cache get error: %s", e)
            return None
    
    def set_stock_data(self, ticker: str, period: str, data_type: str, data: Dict[str, Any]) -> bool:
        try:
            ticker = ticker.upper()
            ttl_hours = self.cache_ttl.get(data_type, 2)
            expires_at = datetime.utcnow() + timedelta(hours=ttl_hours)
            data_points = None
            if data_type == 'history' and isinstance(data, dict) and 'ohlcv' in data:
                data_points = len(data['ohlcv'])
            self.db.query(StockDataCache).filter(
                StockDataCache.ticker == ticker,
                StockDataCache.period == period,
                StockDataCache.data_type == data_type
            ).delete()
            cache_entry = StockDataCache(
                ticker=ticker,
                period=period,
                data_type=data_type,
                data=data,
                expires_at=expires_at,
                data_points=data_points
            )
            self.db.add(cache_entry)
            self.db.commit()
            logger.debug("cache set %s %s %s ttl=%sh", ticker, period, data_type, ttl_hours)
            return True
        except Exception as e:
            logger.error("cache set error: %s", e)
            self.db.rollback()
            return False
    
    def get_sentiment_analysis(self, ticker: str, period: str, model: str) -> Optional[Dict[str, Any]]:
        try:
            cache_entry = self.db.query(SentimentAnalysisCache).filter(
                SentimentAnalysisCache.ticker == ticker.upper(),
                SentimentAnalysisCache.period == period,
                SentimentAnalysisCache.model == model,
                SentimentAnalysisCache.expires_at > datetime.utcnow()
            ).first()
            if cache_entry:
                logger.debug("sentiment cache hit %s %s", ticker, model)
                return cache_entry.analysis_data
            else:
                logger.debug("sentiment cache miss %s %s", ticker, model)
                return None
        except Exception as e:
            logger.warning("sentiment cache get error: %s", e)
            return None
    
    def set_sentiment_analysis(self, ticker: str, period: str, model: str, analysis_data: Dict[str, Any], processing_time_ms: float = None) -> bool:
        try:
            ticker = ticker.upper()
            ttl_hours = self.cache_ttl.get('sentiment', 6)
            expires_at = datetime.utcnow() + timedelta(hours=ttl_hours)
            analysis_text = analysis_data.get('sentiment_analysis', {}).get('full_analysis', '')
            self.db.query(SentimentAnalysisCache).filter(
                SentimentAnalysisCache.ticker == ticker,
                SentimentAnalysisCache.period == period,
                SentimentAnalysisCache.model == model
            ).delete()
            cache_entry = SentimentAnalysisCache(
                ticker=ticker,
                period=period,
                model=model,
                analysis_data=analysis_data,
                analysis_text=analysis_text[:1000] if analysis_text else None,
                expires_at=expires_at,
                processing_time_ms=processing_time_ms
            )
            self.db.add(cache_entry)
            self.db.commit()
            logger.debug("sentiment cache set %s %s", ticker, model)
            return True
        except Exception as e:
            logger.error("sentiment cache set error: %s", e)
            self.db.rollback()
            return False


def get_cache_service(db: Session) -> FinancialCacheService:
    return FinancialCacheService(db)

