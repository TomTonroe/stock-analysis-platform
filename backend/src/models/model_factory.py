"""
Model factory for easy switching between time-series prediction models.
"""

from typing import Dict, List
from models.base_predictor import TimeSeriesPredictor
from models.predictors import ChronosBoltPredictor


# Available models registry
AVAILABLE_MODELS = {
    # Chronos-Bolt models (Fast transformer-based)
    'chronos-bolt-tiny': {
        'name': 'Chronos-Bolt Tiny',
        'description': 'Amazon Chronos-Bolt 9M params - Lightning fast (250x faster!)',
        'class': ChronosBoltPredictor,
        'params': {'model_size': 'tiny'}
    },
    'chronos-bolt-mini': {
        'name': 'Chronos-Bolt Mini', 
        'description': 'Amazon Chronos-Bolt 21M params - Fast & accurate',
        'class': ChronosBoltPredictor,
        'params': {'model_size': 'mini'}
    },
    'chronos-bolt-small': {
        'name': 'Chronos-Bolt Small',
        'description': 'Amazon Chronos-Bolt 48M params - Great balance',
        'class': ChronosBoltPredictor,
        'params': {'model_size': 'small'}
    },
}


def get_predictor(model_name: str) -> TimeSeriesPredictor:
    """
    Create a predictor instance by name.
    
    Args:
        model_name: Name of the model ('prophet', 'chronos-tiny', etc.)
        
    Returns:
        TimeSeriesPredictor: Configured predictor instance
    """
    if model_name not in AVAILABLE_MODELS:
        available = list(AVAILABLE_MODELS.keys())
        raise ValueError(f"Unknown model '{model_name}'. Available: {available}")
    
    model_info = AVAILABLE_MODELS[model_name]
    model_class = model_info['class']
    model_params = model_info['params']
    
    return model_class(**model_params)


def list_available_models() -> Dict[str, Dict]:
    """Get list of all available models with descriptions."""
    return {
        name: {
            'name': info['name'],
            'description': info['description']
        }
        for name, info in AVAILABLE_MODELS.items()
    }


def predict_with_model(model_name: str, ticker: str, forecast_days: int = 30, period: str = "2y", db=None) -> Dict:
    """
    Convenient function to predict with any model.
    
    Args:
        model_name: Model to use ('prophet', 'chronos-tiny', etc.)
        ticker: Stock ticker
        forecast_days: Days to forecast  
        period: Historical data period
        db: Database session for caching
        
    Returns:
        dict: Prediction results
    """
    predictor = get_predictor(model_name)
    return predictor.predict_stock_price(ticker, forecast_days, period, db)