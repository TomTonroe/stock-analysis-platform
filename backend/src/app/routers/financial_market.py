"""
Financial Market Data Endpoints

Includes: ticker info, historical data, and summary (with optional extended details).
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import yfinance as yf

from database import get_db
from services.cache_service import get_cache_service
from data.financial_stocks_loader import get_ticker_info
from app.schemas import APIResponse
from services.data_processing import (
    clean_number,
    to_iso_date,
    safe_fetch_with_timeout,
    process_calendar_data,
    detect_security_type_and_market,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/financial", tags=["financial"])


@router.get("/ticker/{ticker}")
async def get_ticker_info_endpoint(ticker: str, db: Session = Depends(get_db)):
    ticker_info = get_ticker_info(ticker, db)
    if ticker_info.get("error"):
        raise HTTPException(status_code=404, detail=f"Invalid ticker: {ticker}")
    return ticker_info


@router.get("/history/{ticker}")
async def get_ticker_history(ticker: str, period: str = "1y", db: Session = Depends(get_db)):
    try:
        ticker_info = get_ticker_info(ticker, db)
        if ticker_info.get("error"):
            raise HTTPException(status_code=404, detail=f"Invalid ticker: {ticker}")

        valid_periods = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
        if period not in valid_periods:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid period: {period}. Valid periods: {', '.join(valid_periods)}",
            )

        cache_service = get_cache_service(db)
        cached_data = cache_service.get_stock_data(ticker, period, "history")
        if cached_data and "ohlcv" in cached_data:
            logger.debug("history cache hit %s %s", ticker, period)
            return APIResponse.success_response(
                data=cached_data,
                message=f"Cached historical data for {ticker_info['longName']} ({period})",
            )

        stock = yf.Ticker(ticker)
        interval_mapping = {
            "1d": "5m",
            "5d": "15m",
            "1mo": "1h",
            "3mo": "1d",
            "6mo": "1d",
            "1y": "1d",
            "2y": "1wk",
            "5y": "1wk",
            "10y": "1mo",
            "ytd": "1d",
            "max": "1mo",
        }
        interval = interval_mapping.get(period, "1d")

        try:
            history = stock.history(period=period, interval=interval)
        except Exception:
            history = stock.history(period=period)
            interval = "1d"

        if history.empty:
            raise HTTPException(
                status_code=404, detail=f"No historical data available for {ticker_info['symbol']}"
            )

        is_intraday = interval in ["1m", "5m", "15m", "30m", "1h", "2h", "4h"]
        data = {
            "ticker": ticker,
            "company_name": ticker_info.get("longName", ticker),
            "period": period,
            "interval": interval,
            "data_points": len(history),
            "date_range": {
                "start": history.index.min().strftime("%Y-%m-%d"),
                "end": history.index.max().strftime("%Y-%m-%d"),
            },
            "ohlcv": [
                {
                    "date": (
                        date.strftime("%Y-%m-%d %H:%M")
                        if is_intraday
                        else date.strftime("%Y-%m-%d")
                    ),
                    "timestamp": date.isoformat(),
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": int(row["Volume"]),
                }
                for date, row in history.iterrows()
            ],
        }

        cache_service.set_stock_data(ticker, period, "history", data)
        logger.debug("history cache set %s %s", ticker, period)
        return APIResponse.success_response(
            data=data,
            message=f"Historical data for {ticker_info.get('longName', ticker)} ({period})",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical data: {str(e)}")


@router.get("/summary/{ticker}", response_model=APIResponse)
async def get_ticker_summary(ticker: str, extended: bool = False, db: Session = Depends(get_db)):
    res = get_ticker_info(ticker, db)
    if res.get("error"):
        raise HTTPException(status_code=404, detail=f"Invalid ticker: {ticker}")
    symbol = res["symbol"]

    cache_service = get_cache_service(db)
    if extended:
        cached_ext = cache_service.get_stock_data(ticker, "summary_ext", "summary_ext")
        if cached_ext:
            logger.debug("summary_ext cache hit %s", ticker)
            return APIResponse.success_response(
                data=cached_ext, message=f"Cached extended summary for {symbol}"
            )
    else:
        cached_summary = cache_service.get_stock_data(ticker, "summary", "summary")
        if cached_summary:
            logger.debug("summary cache hit %s", ticker)
            return APIResponse.success_response(
                data=cached_summary, message=f"Cached comprehensive summary for {symbol}"
            )

    try:
        t = yf.Ticker(symbol)
        info = safe_fetch_with_timeout(lambda: t.info, timeout_seconds=10, default={}) or {}
        fast = safe_fetch_with_timeout(lambda: t.fast_info, timeout_seconds=5, default={}) or {}

        news = safe_fetch_with_timeout(lambda: t.get_news(count=10), timeout_seconds=8, default=[])
        if not news or len(news) == 0:
            news = safe_fetch_with_timeout(lambda: t.news, timeout_seconds=5, default=[])

        calendar = safe_fetch_with_timeout(lambda: t.calendar, timeout_seconds=3, default={})
        recommendations = safe_fetch_with_timeout(
            lambda: t.get_recommendations_summary(as_dict=True), timeout_seconds=3, default={}
        )

        institutional_holders_raw = safe_fetch_with_timeout(
            lambda: t.get_institutional_holders(as_dict=True), timeout_seconds=5, default={}
        )
        institutional_data = []
        if isinstance(institutional_holders_raw, dict) and "Holder" in institutional_holders_raw:
            try:
                holders = institutional_holders_raw.get("Holder", [])
                shares = institutional_holders_raw.get("Shares", [])
                date_reported = institutional_holders_raw.get("Date Reported", [])
                pct_out = institutional_holders_raw.get("% Out", [])
                value = institutional_holders_raw.get("Value", [])
                for i in range(min(10, len(holders))):
                    institutional_data.append(
                        {
                            "holder": holders[i] if i < len(holders) else "",
                            "shares": shares[i] if i < len(shares) else 0,
                            "dateReported": str(date_reported[i]) if i < len(date_reported) else "",
                            "pctOut": (
                                float(pct_out[i])
                                if i < len(pct_out) and pct_out[i] is not None
                                else 0
                            ),
                            "value": (
                                float(value[i]) if i < len(value) and value[i] is not None else 0
                            ),
                        }
                    )
            except Exception:
                institutional_data = []

        security_info = detect_security_type_and_market(info, symbol)
        etf_data = {}
        if security_info["type"] == "etf":
            try:
                etf_data = {
                    "expenseRatio": clean_number(info.get("annualReportExpenseRatio")),
                    "netAssets": clean_number(info.get("totalAssets")),
                    "inceptionDate": to_iso_date(info.get("fundInceptionDate")),
                    "category": info.get("category"),
                    "fundFamily": info.get("fundFamily"),
                    "ytdReturn": clean_number(info.get("ytdReturn")),
                    "threeYearAverageReturn": clean_number(info.get("threeYearAverageReturn")),
                    "fiveYearAverageReturn": clean_number(info.get("fiveYearAverageReturn")),
                }
                try:
                    holdings_data = safe_fetch_with_timeout(
                        lambda: t.get_funds_data(), timeout_seconds=5
                    )
                    if holdings_data and hasattr(holdings_data, "top_holdings"):
                        etf_data["topHoldings"] = holdings_data.top_holdings.to_dict("records")[:10]
                    else:
                        etf_data["topHoldings"] = []
                except Exception:
                    etf_data["topHoldings"] = []
            except Exception:
                etf_data = {}

        mutual_fund_data = {}
        if security_info["type"] == "mutual_fund":
            try:
                mutual_fund_data = {
                    "expenseRatio": clean_number(info.get("annualReportExpenseRatio")),
                    "netAssets": clean_number(info.get("totalAssets")),
                    "inceptionDate": to_iso_date(info.get("fundInceptionDate")),
                    "category": info.get("category"),
                    "fundFamily": info.get("fundFamily"),
                    "ytdReturn": clean_number(info.get("ytdReturn")),
                    "threeYearAverageReturn": clean_number(info.get("threeYearAverageReturn")),
                    "fiveYearAverageReturn": clean_number(info.get("fiveYearAverageReturn")),
                }
            except Exception:
                mutual_fund_data = {}

        data = {
            "ticker": symbol,
            "securityType": security_info["type"],
            "quoteType": security_info["quote_type"],
            "market": security_info["market"],
            "company": {
                "longName": info.get("longName") or res.get("name"),
                "shortName": info.get("shortName"),
                "exchange": info.get("exchange"),
                "currency": info.get("currency"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "country": info.get("country"),
                "website": info.get("website"),
                "summary": info.get("longBusinessSummary"),
                "employees": info.get("fullTimeEmployees"),
                "founded": info.get("governanceEpochDate"),
                "headquarters": f"{info.get('city', '')}, {info.get('state', '')} {info.get('country', '')}".strip(
                    ", "
                ),
            },
            "metrics": {
                "marketCap": clean_number(info.get("marketCap") or fast.get("marketCap")),
                "enterpriseValue": clean_number(info.get("enterpriseValue")),
                "trailingPE": clean_number(info.get("trailingPE")),
                "forwardPE": clean_number(info.get("forwardPE")),
                "priceToBook": clean_number(info.get("priceToBook")),
                "pegRatio": clean_number(info.get("pegRatio")),
                "beta": clean_number(info.get("beta")),
                "returnOnEquity": clean_number(info.get("returnOnEquity")),
                "debtToEquity": clean_number(info.get("debtToEquity")),
                "profitMargins": clean_number(info.get("profitMargins")),
                "grossMargins": clean_number(info.get("grossMargins")),
                "operatingMargins": clean_number(info.get("operatingMargins")),
                "revenueGrowth": clean_number(info.get("revenueGrowth")),
                "earningsGrowth": clean_number(info.get("earningsGrowth")),
                "currentRatio": clean_number(info.get("currentRatio")),
                "quickRatio": clean_number(info.get("quickRatio")),
                "returnOnAssets": clean_number(info.get("returnOnAssets")),
            },
            "price": {
                "lastPrice": clean_number(fast.get("lastPrice")),
                "previousClose": clean_number(
                    fast.get("previousClose") or info.get("previousClose")
                ),
                "open": clean_number(info.get("open")),
                "dayLow": clean_number(fast.get("dayLow") or info.get("dayLow")),
                "dayHigh": clean_number(fast.get("dayHigh") or info.get("dayHigh")),
                "fiftyTwoWeekLow": clean_number(info.get("fiftyTwoWeekLow") or fast.get("yearLow")),
                "fiftyTwoWeekHigh": clean_number(
                    info.get("fiftyTwoWeekHigh") or fast.get("yearHigh")
                ),
                "fiftyDayAverage": clean_number(info.get("fiftyDayAverage")),
                "twoHundredDayAverage": clean_number(info.get("twoHundredDayAverage")),
                "volume": clean_number(info.get("volume")),
                "avgVolume": clean_number(info.get("averageVolume")),
                "avgVolume10days": clean_number(info.get("averageVolume10days")),
            },
            "dividends": {
                "dividendRate": clean_number(info.get("dividendRate")),
                "dividendYield": clean_number(
                    info.get("dividendYield") or info.get("trailingAnnualDividendYield")
                ),
                "trailingAnnualDividendRate": clean_number(info.get("trailingAnnualDividendRate")),
                "exDividendDate": to_iso_date(info.get("exDividendDate")),
                "lastDividendDate": to_iso_date(info.get("lastDividendDate")),
                "payoutRatio": clean_number(info.get("payoutRatio")),
                "fiveYearAvgDividendYield": clean_number(info.get("fiveYearAvgDividendYield")),
            },
            "splits": {
                "lastSplitDate": to_iso_date(info.get("lastSplitDate")),
                "lastSplitFactor": info.get("lastSplitFactor"),
            },
            "shares": {
                "sharesOutstanding": clean_number(
                    info.get("sharesOutstanding") or fast.get("shares")
                ),
                "floatShares": clean_number(info.get("floatShares")),
                "heldByInsiders": clean_number(info.get("heldByInsiders")),
                "heldByInstitutions": clean_number(info.get("heldByInstitutions")),
                "shortRatio": clean_number(info.get("shortRatio")),
                "shortPercentOfFloat": clean_number(info.get("shortPercentOfFloat")),
            },
            "analyst": {
                "recommendationKey": info.get("recommendationKey"),
                "targetLowPrice": clean_number(info.get("targetLowPrice")),
                "targetMeanPrice": clean_number(info.get("targetMeanPrice")),
                "targetHighPrice": clean_number(info.get("targetHighPrice")),
                "numberOfAnalystOpinions": info.get("numberOfAnalystOpinions"),
                "recommendationMean": clean_number(info.get("recommendationMean")),
            },
            "earnings": {
                "forwardEps": clean_number(info.get("forwardEps")),
                "trailingEps": clean_number(info.get("trailingEps")),
                "earningsQuarterlyGrowth": clean_number(info.get("earningsQuarterlyGrowth")),
                "earningsDate": to_iso_date(info.get("earningsDate")),
                "dates": [],
            },
            "financial": {
                "totalCash": clean_number(info.get("totalCash")),
                "totalCashPerShare": clean_number(info.get("totalCashPerShare")),
                "totalDebt": clean_number(info.get("totalDebt")),
                "totalRevenue": clean_number(info.get("totalRevenue")),
                "revenuePerShare": clean_number(info.get("revenuePerShare")),
                "bookValue": clean_number(info.get("bookValue")),
                "priceToSalesTrailing12Months": clean_number(
                    info.get("priceToSalesTrailing12Months")
                ),
                "enterpriseToRevenue": clean_number(info.get("enterpriseToRevenue")),
                "enterpriseToEbitda": clean_number(info.get("enterpriseToEbitda")),
            },
            "holders": {"major": {}, "institutional": institutional_data},
            "news": (
                [
                    {
                        "title": article.get("title", ""),
                        "publisher": article.get("publisher", ""),
                        "link": article.get("link", ""),
                        "providerPublishTime": article.get("providerPublishTime"),
                        "type": article.get("type", ""),
                    }
                    for article in (news or [])[:5]
                ]
                if news
                else []
            ),
            "upgrades_downgrades": [],
            "calendar": process_calendar_data(calendar),
            "recommendations": recommendations or {},
        }

        if security_info["type"] == "etf":
            data["etf"] = etf_data
        elif security_info["type"] == "crypto":
            data["crypto"] = {
                "marketCap": clean_number(info.get("marketCap")),
                "volume24Hr": clean_number(info.get("volume24Hr")),
                "circulatingSupply": clean_number(info.get("circulatingSupply")),
                "maxSupply": clean_number(info.get("maxSupply")),
            }
        elif security_info["type"] == "mutual_fund":
            data["mutualFund"] = mutual_fund_data

        if extended:
            try:
                major_holders = safe_fetch_with_timeout(
                    lambda: t.get_major_holders(as_dict=True), timeout_seconds=5, default={}
                )
                if isinstance(major_holders, dict):
                    data["holders"]["major"] = major_holders
            except Exception:
                pass
            try:
                sustainability = safe_fetch_with_timeout(
                    lambda: t.get_sustainability(as_dict=True), timeout_seconds=5, default={}
                )
                if isinstance(sustainability, dict):
                    data["sustainability"] = sustainability
            except Exception:
                pass

        if extended:
            cache_service.set_stock_data(ticker, "summary_ext", "summary_ext", data)
            message = f"Extended summary for {symbol}"
        else:
            cache_service.set_stock_data(ticker, "summary", "summary", data)
            message = f"Comprehensive summary for {symbol}"

        logger.debug("summary cache set %s extended=%s", ticker, extended)
        return APIResponse.success_response(data=data, message=message)

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch comprehensive summary: {str(e)}"
        )
