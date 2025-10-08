"""
News provider abstraction for fetching company and macro news.

Supports multiple news sources:
- YFinanceNewsProvider: Free, company-specific news via yfinance
- NewsAPIProvider: Optional, requires API key, provides macro/market news
"""

from __future__ import annotations
import logging
from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import datetime

import yfinance as yf

from llm.schemas import NewsHeadline
from config.settings import get_settings

logger = logging.getLogger(__name__)


class BaseNewsProvider(ABC):
    """Abstract base class for news providers."""

    @abstractmethod
    def get_company_headlines(
        self,
        ticker: str,
        limit: int = 5
    ) -> List[NewsHeadline]:
        """
        Fetch recent news headlines for a specific company/ticker.

        Args:
            ticker: Stock ticker symbol
            limit: Maximum number of headlines to return

        Returns:
            List of NewsHeadline objects
        """
        pass

    @abstractmethod
    def get_macro_headlines(
        self,
        limit: int = 5
    ) -> List[NewsHeadline]:
        """
        Fetch recent macro/market news headlines.

        Args:
            limit: Maximum number of headlines to return

        Returns:
            List of NewsHeadline objects
        """
        pass


class YFinanceNewsProvider(BaseNewsProvider):
    """
    News provider using yfinance (free, no API key required).

    Provides company-specific news. Cannot provide macro/market news.
    """

    def get_company_headlines(
        self,
        ticker: str,
        limit: int = 5
    ) -> List[NewsHeadline]:
        """Fetch company news from yfinance."""
        try:
            stock = yf.Ticker(ticker)

            # Try the newer get_news() method first
            try:
                news_items = stock.get_news(count=limit * 2)  # Request more to ensure we get enough
            except (AttributeError, Exception):
                # Fall back to .news property if get_news() doesn't exist
                news_items = stock.news or []

            if not news_items:
                logger.debug(f"No news found for {ticker} via yfinance")
                return []

            headlines = []
            for item in news_items[:limit]:
                # yfinance returns different formats, handle both old and new API
                # New API (2024+): {'id': '...', 'content': {'title': '...', 'pubDate': '...', ...}}
                # Old API: {'title': '...', 'providerPublishTime': ..., ...}

                content = item.get('content', {})
                title = (
                    content.get('title') or           # New API nested structure
                    item.get('title') or              # Old API direct field
                    item.get('headline', '')          # Alternative field name
                )

                if not title:
                    continue

                # Handle different timestamp formats
                published_at = None

                # Try new API format (ISO string)
                pub_date = content.get('pubDate') or content.get('displayTime')
                if pub_date:
                    try:
                        # pubDate is already ISO format string
                        published_at = pub_date
                    except (ValueError, TypeError):
                        pass

                # Try old API format (Unix timestamp)
                if not published_at:
                    published_timestamp = item.get('providerPublishTime')
                    if published_timestamp:
                        try:
                            dt = datetime.fromtimestamp(published_timestamp)
                            published_at = dt.isoformat()
                        except (ValueError, TypeError):
                            pass

                # Extract source/publisher
                source = None
                provider = content.get('provider', {})
                if provider:
                    source = provider.get('displayName')
                if not source:
                    source = item.get('publisher') or item.get('source', {}).get('name')

                # Extract URL
                url = None
                canonical_url = content.get('canonicalUrl', {})
                if canonical_url:
                    url = canonical_url.get('url')
                if not url:
                    url = item.get('link') or item.get('url')

                headlines.append(NewsHeadline(
                    title=title,
                    source=source,
                    url=url,
                    published_at=published_at,
                    relevance_score=None  # yfinance doesn't provide relevance scores
                ))

            logger.info(f"Fetched {len(headlines)} headlines for {ticker} from yfinance")
            return headlines

        except Exception as e:
            logger.warning(f"Failed to fetch yfinance news for {ticker}: {str(e)}")
            return []

    def get_macro_headlines(self, limit: int = 5) -> List[NewsHeadline]:
        """YFinance doesn't support macro news - return empty list."""
        logger.debug("YFinance provider cannot fetch macro news")
        return []


class NewsAPIProvider(BaseNewsProvider):
    """
    News provider using NewsAPI.org (requires API key).

    Provides both company-specific and macro/market news.
    """

    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.news_api_key

        if not self.api_key:
            logger.warning("NewsAPI key not configured, provider will return empty results")

        # Import newsapi client (optional dependency)
        try:
            from newsapi import NewsApiClient
            self.client = NewsApiClient(api_key=self.api_key) if self.api_key else None
        except ImportError:
            logger.warning("newsapi-python not installed, NewsAPIProvider will not work")
            self.client = None

    def get_company_headlines(
        self,
        ticker: str,
        limit: int = 5
    ) -> List[NewsHeadline]:
        """Fetch company news from NewsAPI (simple single-query for POC)."""
        if not self.client:
            return []

        try:
            # Get company name (fallback to ticker)
            from data.financial_stocks_loader import get_ticker_info
            try:
                info = get_ticker_info(ticker)
                company_name = info.get('longName') or info.get('shortName') or ticker
            except Exception:
                company_name = ticker

            response = self.client.get_everything(
                q=f'"{company_name}"',
                language='en',
                sort_by='publishedAt',
                page_size=limit,
            )

            if response.get('status') != 'ok':
                return []

            articles = response.get('articles', [])
            headlines: List[NewsHeadline] = []
            for article in articles[:limit]:
                title = article.get('title')
                if not title:
                    continue
                headlines.append(NewsHeadline(
                    title=title,
                    source=article.get('source', {}).get('name'),
                    url=article.get('url'),
                    published_at=article.get('publishedAt'),
                ))
            return headlines

        except Exception:
            return []

    def get_macro_headlines(self, limit: int = 5) -> List[NewsHeadline]:
        """Fetch macro/market news from NewsAPI."""
        if not self.client:
            return []

        try:
            # Search for general market/economy news
            query = 'stock market OR economy OR Federal Reserve OR inflation OR GDP'

            response = self.client.get_everything(
                q=query,
                language='en',
                sort_by='publishedAt',
                page_size=limit,
                domains='reuters.com,bloomberg.com,ft.com,wsj.com,cnbc.com'  # Focus on financial sources
            )

            if response.get('status') != 'ok':
                logger.warning(f"NewsAPI error for macro news: {response.get('message')}")
                return []

            articles = response.get('articles', [])
            headlines = []

            for article in articles[:limit]:
                headlines.append(NewsHeadline(
                    title=article.get('title', ''),
                    source=article.get('source', {}).get('name'),
                    url=article.get('url'),
                    published_at=article.get('publishedAt'),
                    relevance_score=None
                ))

            logger.info(f"Fetched {len(headlines)} macro headlines from NewsAPI")
            return headlines

        except Exception as e:
            logger.warning(f"Failed to fetch NewsAPI macro news: {str(e)}")
            return []


def resolve_news_provider() -> BaseNewsProvider:
    """
    Resolve the appropriate news provider based on configuration.

    Returns NewsAPIProvider if NEWS_API_KEY is configured, otherwise YFinanceNewsProvider.
    """
    settings = get_settings()

    if settings.news_api_key:
        logger.info("Using NewsAPIProvider (API key configured)")
        return NewsAPIProvider()
    else:
        logger.info("Using YFinanceNewsProvider (free, company news only)")
        return YFinanceNewsProvider()
