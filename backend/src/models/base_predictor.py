"""
Base interface for time-series prediction models.
Makes it easy to swap between different HuggingFace models, etc.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any
import pandas as pd
import logging

logger = logging.getLogger(__name__)


class TimeSeriesPredictor(ABC):
    """Base class for all time-series prediction models."""
    
    def __init__(self, name: str):
        self.name = name
        self.is_trained = False
    
    @abstractmethod
    def train(self, data: pd.DataFrame) -> None:
        """Train the model on historical stock data."""
        pass
    
    @abstractmethod
    def predict(self, forecast_days: int) -> Dict[str, Any]:
        """Generate predictions for future days."""
        pass
    
    @abstractmethod
    def get_metrics(self) -> Dict[str, float]:
        """Return model performance metrics."""
        pass
    
    def predict_stock_price(self, ticker: str, forecast_days: int = 30, period: str = "2y", db=None) -> Dict[str, Any]:
        """
        Main interface - predict stock price for any model.
        
        Args:
            ticker: Stock ticker symbol
            forecast_days: Number of days to forecast
            period: Historical data period
            db: Database session for caching
            
        Returns:
            dict: Standardized prediction results
        """
        from data.financial_stocks_loader import load_financial_stocks_data
        
        logger.info("%s: Predicting %s for %s days using %s data", self.name, ticker, forecast_days, period)
        
        # Load data with database session for caching
        df = load_financial_stocks_data(ticker, period=period, db=db)
        
        # Train model
        self.train(df)
        
        # Generate predictions
        prediction_result = self.predict(forecast_days)
        
        # Get metrics
        metrics = self.get_metrics()
        
        # Standardize output format
        current_price = float(df['Close'].iloc[-1])
        forecast_prices = prediction_result['forecast_prices']
        forecast_price = forecast_prices[-1] if forecast_prices else current_price
        
        price_change = forecast_price - current_price
        percent_change = (price_change / current_price) * 100
        
        logger.info("%s: $%.2f → $%.2f (%+.1f%%)", self.name, current_price, forecast_price, percent_change)
        
        return {
            'model_name': self.name,
            'ticker': ticker,
            'current_price': current_price,
            'forecast_price': forecast_price,
            'price_change': price_change,
            'percent_change': percent_change,
            'forecast_dates': prediction_result['forecast_dates'],
            'forecast_prices': forecast_prices,
            'confidence_lower': prediction_result.get('confidence_lower', forecast_prices),
            'confidence_upper': prediction_result.get('confidence_upper', forecast_prices),
            'metrics': {
                **metrics,
                'forecast_days': forecast_days,
                'model_name': self.name
            },
            'historical_data': {
                'dates': [d.strftime('%Y-%m-%d') for d in df.index],
                'prices': df['Close'].tolist()
            }
        }
