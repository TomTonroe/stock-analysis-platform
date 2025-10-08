"""
Context builder for enriching LLM analysis with news and market data.

Provides functions to enhance analysis context with:
- Company-specific news headlines
- Macro/market news headlines
- Proper metadata tracking for data sources
"""

from __future__ import annotations
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from llm.schemas import NewsHeadline
from context.news_provider import resolve_news_provider
from config.settings import get_settings

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    """Get current UTC time as naive datetime (consistent with DB)."""
    return datetime.utcnow()


def _get_news_cache(
    db: Optional[Session],
    ticker: str,
    category: str
) -> Optional[List[Dict]]:
    """
    Retrieve cached news headlines from database.

    Args:
        db: Database session (optional)
        ticker: Stock ticker or "macro" for macro news
        category: News category ("company" or "macro")

    Returns:
        List of cached headline dicts or None if not found/expired
    """
    if not db:
        return None

    # For POC simplicity, skip DB cache lookup
    return None


def _set_news_cache(
    db: Optional[Session],
    ticker: str,
    category: str,
    headlines: List[NewsHeadline],
    ttl_minutes: int
) -> bool:
    """
    Cache news headlines in database.

    Args:
        db: Database session (optional)
        ticker: Stock ticker or "macro" for macro news
        category: News category ("company" or "macro")
        headlines: List of NewsHeadline objects to cache
        ttl_minutes: Time-to-live in minutes

    Returns:
        True if cached successfully, False otherwise
    """
    if not db:
        return False

    # For POC simplicity, skip DB caching
    return False




def enrich_with_news(
    base_context: Dict[str, Any],
    ticker: str,
    include_company_news: bool = True,
    include_macro_news: bool = True,
    company_limit: int = 5,
    macro_limit: int = 3,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Enrich analysis context with news headlines.

    This function:
    1. Checks cache for recent headlines
    2. Fetches fresh headlines if cache miss or expired
    3. Caches the fetched headlines
    4. Adds headlines to context
    5. Updates metadata.data_sources flags

    Args:
        base_context: Base context dict to enrich
        ticker: Stock ticker symbol
        include_company_news: Whether to include company-specific news
        include_macro_news: Whether to include macro/market news
        company_limit: Max number of company headlines
        macro_limit: Max number of macro headlines
        db: Database session for caching (optional)

    Returns:
        Enriched context dict with news_context section
    """
    settings = get_settings()
    enriched_context = base_context.copy()

    company_headlines: List[NewsHeadline] = []
    macro_headlines: List[NewsHeadline] = []

    # Initialize news provider
    news_provider = resolve_news_provider()

    # Fetch company news
    if include_company_news:
        # Check cache first
        cached_company_news = _get_news_cache(db, ticker, "company")

        if cached_company_news:
            company_headlines = [NewsHeadline(**h) for h in cached_company_news]
        else:
            # Cache miss - fetch fresh headlines
            try:
                company_headlines = news_provider.get_company_headlines(ticker, company_limit)

                # Cache the results
                if company_headlines:
                    _set_news_cache(
                        db,
                        ticker,
                        "company",
                        company_headlines,
                        ttl_minutes=getattr(settings, 'news_cache_ttl_minutes', 15)
                    )
            except Exception as e:
                logger.warning(f"Failed to fetch company news for {ticker}: {str(e)}")
                company_headlines = []

    # Fetch macro news
    if include_macro_news:
        # Check cache first
        cached_macro_news = _get_news_cache(db, "macro", "macro")

        if cached_macro_news:
            macro_headlines = [NewsHeadline(**h) for h in cached_macro_news]
        else:
            # Cache miss - fetch fresh headlines
            try:
                macro_headlines = news_provider.get_macro_headlines(macro_limit)

                # Cache the results
                if macro_headlines:
                    _set_news_cache(
                        db,
                        "macro",
                        "macro",
                        macro_headlines,
                        ttl_minutes=getattr(settings, 'macro_news_cache_ttl_minutes', 30)
                    )
            except Exception as e:
                logger.warning(f"Failed to fetch macro news: {str(e)}")
                macro_headlines = []

    # Add news to context
    enriched_context['news_context'] = {
        'company_headlines': [h.model_dump() for h in company_headlines],
        'macro_headlines': [h.model_dump() for h in macro_headlines],
        'company_count': len(company_headlines),
        'macro_count': len(macro_headlines)
    }

    # Update metadata if it exists
    if 'metadata' not in enriched_context:
        enriched_context['metadata'] = {}

    if 'data_sources' not in enriched_context['metadata']:
        enriched_context['metadata']['data_sources'] = {}

    enriched_context['metadata']['data_sources']['news_company'] = len(company_headlines) > 0
    enriched_context['metadata']['data_sources']['news_macro'] = len(macro_headlines) > 0

    logger.info(
        f"Enriched context for {ticker} with {len(company_headlines)} company "
        f"and {len(macro_headlines)} macro headlines"
    )

    return enriched_context


def format_news_for_prompt(headlines: List[NewsHeadline], max_headlines: int = 5) -> str:
    """
    Format news headlines for inclusion in LLM prompt.

    Args:
        headlines: List of NewsHeadline objects
        max_headlines: Maximum number to include

    Returns:
        Formatted string for prompt inclusion
    """
    if not headlines:
        return "No recent news available."

    formatted_lines = []
    for i, headline in enumerate(headlines[:max_headlines], 1):
        line = f"{i}. {headline.title}"
        if headline.source:
            line += f" (Source: {headline.source})"
        if headline.published_at:
            try:
                # Try to format the date nicely
                dt = datetime.fromisoformat(headline.published_at.replace('Z', '+00:00'))
                line += f" [{dt.strftime('%Y-%m-%d')}]"
            except (ValueError, AttributeError):
                pass
        formatted_lines.append(line)

    return "\n".join(formatted_lines)
