"""
Data processing helpers used by API routers and services.
"""
import concurrent.futures
from typing import Any, Optional, Dict, List
from datetime import datetime as _dt


def clean_number(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def to_iso_date(dt_value: Any) -> Optional[str]:
    try:
        if dt_value is None:
            return None
        if isinstance(dt_value, (int, float)):
            try:
                return _dt.utcfromtimestamp(int(dt_value)).isoformat()
            except Exception:
                return None
        return dt_value.isoformat()
    except Exception:
        return None


def safe_fetch_with_timeout(func, timeout_seconds=5, default=None):
    try:
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(func)
            return future.result(timeout=timeout_seconds)
    except (concurrent.futures.TimeoutError, Exception):
        return default


def process_calendar_data(calendar) -> Dict[str, List[str]]:
    if not calendar:
        return {"earnings": [], "dividends": [], "exDividend": []}
    try:
        if hasattr(calendar, 'to_dict'):
            calendar_dict = calendar.to_dict('records')
            earnings, dividends, ex_dividend = [], [], []
            for record in calendar_dict:
                if 'Earnings Date' in record and record['Earnings Date']:
                    earnings.append(record['Earnings Date'])
                if 'Dividend Date' in record and record['Dividend Date']:
                    dividends.append(record['Dividend Date'])
                if 'Ex-Dividend Date' in record and record['Ex-Dividend Date']:
                    ex_dividend.append(record['Ex-Dividend Date'])
            return {"earnings": earnings, "dividends": dividends, "exDividend": ex_dividend}
        elif isinstance(calendar, dict):
            earnings = []
            dividends = []
            ex_dividend = []
            earnings_data = calendar.get("Earnings Date")
            if earnings_data:
                earnings = [str(d) for d in (earnings_data if isinstance(earnings_data, list) else [earnings_data])]
            dividend_data = calendar.get("Dividend Date")
            if dividend_data:
                dividends = [str(d) for d in (dividend_data if isinstance(dividend_data, list) else [dividend_data])]
            ex_div_data = calendar.get("Ex-Dividend Date")
            if ex_div_data:
                ex_dividend = [str(d) for d in (ex_div_data if isinstance(ex_div_data, list) else [ex_div_data])]
            return {"earnings": earnings, "dividends": dividends, "exDividend": ex_dividend}
        else:
            return {"earnings": [], "dividends": [], "exDividend": []}
    except Exception:
        return {"earnings": [], "dividends": [], "exDividend": []}


def detect_security_type_and_market(info: dict, symbol: str) -> Dict[str, Any]:
    quote_type = info.get('quoteType', '').upper()
    type_mapping = {
        'EQUITY': 'stock',
        'ETF': 'etf',
        'MUTUALFUND': 'mutual_fund',
        'INDEX': 'index',
        'CRYPTOCURRENCY': 'crypto',
        'CURRENCY': 'currency',
        'FUTURE': 'future',
        'OPTION': 'option',
    }
    security_type = type_mapping.get(quote_type, 'stock')
    market_info = detect_market_info(symbol, info)
    return {'type': security_type, 'quote_type': quote_type, 'market': market_info}


def detect_market_info(symbol: str, info: dict) -> Dict[str, str]:
    exchange = info.get('exchange', '')
    if '.' in symbol:
        suffix = symbol.split('.')[-1].upper()
        market_map = {
            'TO': {'country': 'Canada', 'market': 'TSX', 'currency': 'CAD', 'timezone': 'America/Toronto'},
            'L': {'country': 'United Kingdom', 'market': 'LSE', 'currency': 'GBP', 'timezone': 'Europe/London'},
            'DE': {'country': 'Germany', 'market': 'XETRA', 'currency': 'EUR', 'timezone': 'Europe/Berlin'},
            'PA': {'country': 'France', 'market': 'Euronext Paris', 'currency': 'EUR', 'timezone': 'Europe/Paris'},
            'AS': {'country': 'Netherlands', 'market': 'Euronext Amsterdam', 'currency': 'EUR', 'timezone': 'Europe/Amsterdam'},
            'MI': {'country': 'Italy', 'market': 'Borsa Italiana', 'currency': 'EUR', 'timezone': 'Europe/Rome'},
            'MC': {'country': 'Spain', 'market': 'BME', 'currency': 'EUR', 'timezone': 'Europe/Madrid'},
            'SW': {'country': 'Switzerland', 'market': 'SIX Swiss', 'currency': 'CHF', 'timezone': 'Europe/Zurich'},
            'T': {'country': 'Japan', 'market': 'TSE', 'currency': 'JPY', 'timezone': 'Asia/Tokyo'},
            'HK': {'country': 'Hong Kong', 'market': 'HKEX', 'currency': 'HKD', 'timezone': 'Asia/Hong_Kong'},
            'SS': {'country': 'China', 'market': 'Shanghai Stock Exchange', 'currency': 'CNY', 'timezone': 'Asia/Shanghai'},
            'SZ': {'country': 'China', 'market': 'Shenzhen Stock Exchange', 'currency': 'CNY', 'timezone': 'Asia/Shanghai'},
            'AX': {'country': 'Australia', 'market': 'ASX', 'currency': 'AUD', 'timezone': 'Australia/Sydney'},
            'SI': {'country': 'Singapore', 'market': 'SGX', 'currency': 'SGD', 'timezone': 'Asia/Singapore'},
            'KS': {'country': 'South Korea', 'market': 'KOSPI', 'currency': 'KRW', 'timezone': 'Asia/Seoul'},
            'NS': {'country': 'India', 'market': 'NSE', 'currency': 'INR', 'timezone': 'Asia/Kolkata'},
            'BO': {'country': 'India', 'market': 'BSE', 'currency': 'INR', 'timezone': 'Asia/Kolkata'},
            'SA': {'country': 'Brazil', 'market': 'B3', 'currency': 'BRL', 'timezone': 'America/Sao_Paulo'},
        }
        if suffix in market_map:
            return market_map[suffix]
    return {
        'country': 'United States',
        'market': exchange or 'NASDAQ/NYSE',
        'currency': info.get('currency', 'USD'),
        'timezone': 'America/New_York',
    }

