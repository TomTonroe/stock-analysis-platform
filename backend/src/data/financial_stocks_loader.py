"""
Financial Stocks Data Loader

Comprehensive data loader for financial time-series data using yfinance.
Provides ticker resolution, data validation, technical indicators, and caching.

Usage:
    df = load_financial_stocks_data("AAPL", period="2y")
    ticker_info = resolve_ticker("Apple")
"""

import pandas as pd
import numpy as np
import yfinance as yf
from typing import Optional, Union, Dict, Any, List
import warnings
import logging
from sqlalchemy.orm import Session

from services.cache_service import get_cache_service

# Suppress yfinance warnings for cleaner output
warnings.filterwarnings("ignore", category=FutureWarning)
logging.getLogger("yfinance").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


def load_financial_stocks_data(
    ticker_symbols: Union[str, List[str]],
    period: str = "2y",
    nrows: Optional[int] = None,
    db: Optional[Session] = None,
) -> pd.DataFrame:
    """
    Load financial stock data with technical indicators and caching.

    Args:
        ticker_symbols: Single ticker (e.g., "AAPL") or list of tickers
        period: Time period ("1y", "2y", "5y", "max") or start date
        nrows: Limit number of rows (for testing, None = all data)

    Returns:
        pd.DataFrame: Stock data with OHLCV + technical indicators

    Raises:
        ValueError: If ticker is invalid or no data available

    Example:
        # Single ticker
        df = load_financial_stocks_data("AAPL", period="1y")

        # Multiple tickers
        df = load_financial_stocks_data(["AAPL", "MSFT"], period="6mo")
    """

    # Normalize ticker input
    if isinstance(ticker_symbols, str):
        tickers = [ticker_symbols.upper()]
    else:
        tickers = [t.upper() for t in ticker_symbols]

    logger.info("Loading financial data for %s (period=%s)", ", ".join(tickers), period)

    # Initialize cache service if database session provided
    cache_service = None
    if db:
        cache_service = get_cache_service(db)
        logger.debug("Cache service enabled")
    else:
        logger.debug("No database session - caching disabled")

    # Validate tickers first
    valid_tickers = []
    for ticker in tickers:
        if is_valid_ticker(ticker):
            valid_tickers.append(ticker)
        else:
            logger.warning("%s appears to be invalid, skipping", ticker)

    if not valid_tickers:
        raise ValueError(f"No valid tickers found in: {tickers}")

    # Download data with caching
    try:
        if len(valid_tickers) == 1:
            # Single ticker - try cache first
            ticker = valid_tickers[0]
            df = None

            # Try cache if available
            if cache_service:
                cached_data = cache_service.get_stock_data(ticker, period, "history")
                if cached_data and "ohlcv" in cached_data:
                    logger.debug("cache hit history %s %s", ticker, period)
                    # Convert cached OHLCV data back to DataFrame
                    df_data = []
                    for row in cached_data["ohlcv"]:
                        df_data.append(
                            {
                                "Open": row["open"],
                                "High": row["high"],
                                "Low": row["low"],
                                "Close": row["close"],
                                "Volume": row["volume"],
                            }
                        )
                    df = pd.DataFrame(
                        df_data, index=pd.to_datetime([row["date"] for row in cached_data["ohlcv"]])
                    )
                    df["Ticker"] = ticker

            # Download from yfinance if not cached
            if df is None:
                logger.info("Downloading fresh data for %s", ticker)
                stock = yf.Ticker(ticker)
                df = stock.history(period=period)

                if df.empty:
                    raise ValueError(f"No data available for {ticker}")

                # Add ticker column for consistency
                df["Ticker"] = ticker

                # Cache the data if cache service available
                if cache_service:
                    cache_data = {
                        "ticker": ticker,
                        "period": period,
                        "ohlcv": [
                            {
                                "date": date.strftime("%Y-%m-%d"),
                                "open": float(row["Open"]),
                                "high": float(row["High"]),
                                "low": float(row["Low"]),
                                "close": float(row["Close"]),
                                "volume": int(row["Volume"]),
                            }
                            for date, row in df.iterrows()
                        ],
                    }
                    cache_service.set_stock_data(ticker, period, "history", cache_data)
                    logger.debug("cache set history %s rows=%s", ticker, len(df))

        else:
            # Multiple tickers
            df = yf.download(valid_tickers, period=period, group_by="ticker", auto_adjust=True)

            if df.empty:
                raise ValueError(f"No data available for {valid_tickers}")

        # Apply row limit if specified (for testing)
        if nrows and len(df) > nrows:
            df = df.tail(nrows)  # Get most recent N rows

        logger.info("Downloaded %s rows of data", len(df))

        # Process the data
        df = _process_stock_data(df, valid_tickers)

        # Time series models only need OHLCV data - no technical indicators needed
        logger.debug("Using basic OHLCV data for time series forecasting")

        # Data validation
        _validate_stock_data(df)

        logger.info("Final dataset: %s rows, %s columns", len(df), len(df.columns))
        logger.debug("Date range: %s to %s", df.index.min().date(), df.index.max().date())

        return df

    except Exception as e:
        logger.error("Error loading data: %s", e)
        raise ValueError(f"Failed to load data for {tickers}: {str(e)}")


def resolve_ticker(user_input: str) -> Dict[str, Any]:
    """
    Simple ticker validation - just check if the exact ticker exists.

    Args:
        user_input: Ticker symbol to validate

    Returns:
        dict: Validation result

    Example:
        resolve_ticker("AAPL") -> {"symbol": "AAPL", "name": "Apple Inc.", "valid": True}
        resolve_ticker("INVALID") -> {"valid": False, "message": "Ticker not found"}
    """

    user_input = user_input.strip().upper()

    # Direct ticker validation only
    if is_valid_ticker(user_input):
        ticker_info = get_ticker_info(user_input)
        return {
            "symbol": user_input,
            "name": ticker_info.get("longName", user_input),
            "valid": True,
        }

    return {"valid": False, "message": f"Ticker '{user_input}' not found", "input": user_input}


def is_valid_ticker(ticker: str) -> bool:
    """
    Quick validation check for ticker symbol.

    Args:
        ticker: Ticker symbol to validate

    Returns:
        bool: True if ticker appears valid
    """
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        # Check if we got valid info back
        if not info or "symbol" not in info:
            return False

        # Additional validation - check if we can get some recent data
        hist = stock.history(period="5d")
        return not hist.empty

    except Exception:
        return False


def get_ticker_info(ticker: str, db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Get detailed information for a ticker symbol.

    Args:
        ticker: Valid ticker symbol

    Returns:
        dict: Ticker information from yfinance
    """
    # Initialize cache service if database session provided
    cache_service = None
    if db:
        cache_service = get_cache_service(db)

    try:
        # Try cache first
        if cache_service:
            cached_info = cache_service.get_stock_data(ticker, "info", "info")
            if cached_info:
                logger.info(f"Using cached info for {ticker}")
                return cached_info

        # Fetch fresh data
        logger.info(f"Downloading fresh info for {ticker}")
        stock = yf.Ticker(ticker)
        info = stock.info

        # Clean and structure the response
        result = {
            "symbol": ticker,
            "longName": info.get("longName", ticker),
            "shortName": info.get("shortName", ticker),
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
            "marketCap": info.get("marketCap"),
            "currency": info.get("currency", "USD"),
            "exchange": info.get("exchange", "Unknown"),
        }

        # Cache the result
        if cache_service:
            cache_service.set_stock_data(ticker, "info", "info", result)
            logger.debug(f"Cached info for {ticker}")

        return result

    except Exception as e:
        return {"symbol": ticker, "error": str(e)}


def _process_stock_data(df: pd.DataFrame, tickers: List[str]) -> pd.DataFrame:
    """
    Process and clean raw yfinance data.

    Args:
        df: Raw yfinance DataFrame
        tickers: List of ticker symbols

    Returns:
        pd.DataFrame: Processed stock data
    """

    # Ensure we have a DatetimeIndex
    if not isinstance(df.index, pd.DatetimeIndex):
        df.index = pd.to_datetime(df.index)

    # Remove timezone info for consistency
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)

    # Handle multi-ticker data structure
    if len(tickers) == 1:
        # Single ticker - already clean
        pass
    else:
        # Multi-ticker - flatten the structure (keep for future multi-ticker support)
        # For Phase 1, we'll focus on single ticker
        pass

    # Sort by date
    df = df.sort_index()

    # Remove any duplicate indices
    df = df[~df.index.duplicated(keep="last")]

    # Forward fill any small gaps (up to 3 days)
    df = df.fillna(method="ffill", limit=3)

    # Drop rows with remaining NaN values
    df = df.dropna()

    return df


def _validate_stock_data(df: pd.DataFrame) -> None:
    """
    Validate stock data quality and completeness.

    Args:
        df: Stock DataFrame to validate

    Raises:
        ValueError: If data quality is insufficient
    """

    if df.empty:
        raise ValueError("DataFrame is empty")

    # Check for required columns
    required_columns = ["Open", "High", "Low", "Close", "Volume"]
    missing_columns = [col for col in required_columns if col not in df.columns]

    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    # Check for reasonable data
    if len(df) < 30:
        logger.warning("Less than 30 days of data may affect model quality")

    # Check for data quality issues
    if df["Close"].isnull().sum() > len(df) * 0.1:  # More than 10% null
        logger.warning("High percentage of missing price data")

    if (df["Close"] <= 0).any():
        logger.warning("Found non-positive prices - data may be corrupted")

    logger.debug("Data validation passed")
