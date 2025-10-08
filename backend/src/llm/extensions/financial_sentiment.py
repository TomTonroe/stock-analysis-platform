"""
Financial Sentiment Analysis Extension with Structured Outputs and News Context.

This module provides comprehensive stock analysis using:
- Structured LLM outputs (Pydantic-validated)
- Real-time news context (company + macro)
- Technical and fundamental analysis
- Clear investment recommendations
"""

import json
import logging
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional

from data.financial_stocks_loader import load_financial_stocks_data, get_ticker_info
from models.model_factory import list_available_models
from config.settings import get_settings
from llm.schemas import FinancialAnalysisOutput
from llm.structured import generate_structured
from context.context_builder import enrich_with_news, format_news_for_prompt

logger = logging.getLogger(__name__)


class FinancialSentimentAnalyzer:
    """
    Enhanced financial sentiment analyzer with structured outputs and news enrichment.
    """

    def __init__(self, llm_client):
        self.llm_client = llm_client
        self.settings = get_settings()

    def analyze_stock_sentiment(
        self,
        ticker: str,
        period: str = "2y",
        include_predictions: bool = True,
        include_news: bool = True,
        db=None
    ) -> Dict[str, Any]:
        """
        Perform comprehensive financial sentiment analysis with structured output.

        Args:
            ticker: Stock ticker symbol
            period: Historical data period
            include_predictions: Whether to include ML prediction context
            include_news: Whether to include news context
            db: Database session for caching

        Returns:
            Structured analysis dict with investment recommendation
        """
        try:
            start_time = datetime.now()

            # Gather all analysis context
            financial_data = self._get_financial_context(ticker, period, db)
            prediction_data = self._get_prediction_context(ticker, period) if include_predictions else None
            technical_data = self._get_technical_analysis(financial_data['price_df'])

            # Build base context
            base_context = {
                'ticker': ticker.upper(),
                'financial_data': financial_data,
                'technical_analysis': technical_data,
                'predictions': prediction_data
            }

            # Enrich with news if enabled
            if include_news:
                enriched_context = enrich_with_news(
                    base_context,
                    ticker,
                    include_company_news=True,
                    include_macro_news=True,
                    company_limit=5,
                    macro_limit=3,
                    db=db
                )
            else:
                enriched_context = base_context
                enriched_context['news_context'] = {
                    'company_headlines': [],
                    'macro_headlines': [],
                    'company_count': 0,
                    'macro_count': 0
                }

            # Build enhanced prompt with news context
            analysis_instruction = self._build_analysis_instruction(enriched_context)

            # Generate structured output using Pydantic AI
            logger.info(f"Generating structured analysis for {ticker}")
            result = generate_structured(
                llm_client=self.llm_client,
                task_name=f"financial_sentiment_{ticker}",
                task_instruction=analysis_instruction,
                context_data=self._prepare_context_for_llm(enriched_context),
                schema_model=FinancialAnalysisOutput,
                model=self.settings.llm_model,
                temperature=0.1,
                max_tokens=2500
            )

            if not result.success:
                error_msg = "; ".join(result.errors) if result.errors else "Unknown error"
                logger.error(f"Structured generation failed for {ticker}: {error_msg}")
                raise RuntimeError(f"Failed to generate structured analysis: {error_msg}")

            # Convert structured output to API response format
            analysis_output = result.output
            processing_time = (datetime.now() - start_time).total_seconds() * 1000

            # Format response (maintain backward compatibility)
            analysis = self._format_analysis_response(
                analysis_output,
                ticker,
                period,
                processing_time,
                result.duration_ms,
                enriched_context
            )

            logger.info(f"Successfully generated structured analysis for {ticker} in {processing_time:.0f}ms")
            return analysis

        except Exception as e:
            logger.error(f"Analysis failed for {ticker}: {str(e)}", exc_info=True)
            return {
                'error': str(e),
                'ticker': ticker.upper(),
                'analysis_timestamp': datetime.now().isoformat()
            }

    def _get_financial_context(self, ticker: str, period: str, db=None) -> Dict[str, Any]:
        """Gather financial data context (prices, fundamentals, etc.)."""
        df = load_financial_stocks_data(ticker, period, db=db)
        company_info = get_ticker_info(ticker, db)

        current_price = df['Close'].iloc[-1]
        price_1m_ago = df['Close'].iloc[-22] if len(df) >= 22 else df['Close'].iloc[0]
        price_3m_ago = df['Close'].iloc[-66] if len(df) >= 66 else df['Close'].iloc[0]
        price_6m_ago = df['Close'].iloc[-132] if len(df) >= 132 else df['Close'].iloc[0]

        daily_returns = df['Close'].pct_change().dropna()
        volatility = daily_returns.std() * np.sqrt(252) * 100

        avg_volume = df['Volume'].mean()
        recent_volume = df['Volume'].tail(10).mean()
        volume_trend = (recent_volume / avg_volume - 1) * 100

        return {
            'company_info': {
                'name': company_info.get('longName', ticker),
                'sector': company_info.get('sector'),
                'industry': company_info.get('industry'),
                'market': company_info.get('market', {}).get('market') if isinstance(company_info.get('market'), dict) else None,
                'country': company_info.get('country'),
                'market_cap': company_info.get('marketCap')
            },
            'price_df': df,
            'price_action': {
                'current_price': float(current_price),
                'one_month_return': float((current_price / price_1m_ago - 1) * 100),
                'three_month_return': float((current_price / price_3m_ago - 1) * 100),
                'six_month_return': float((current_price / price_6m_ago - 1) * 100),
                'volatility': float(volatility),
                'volume_trend': float(volume_trend),
                'data_points': len(df),
                'date_range': {
                    'start': df.index.min().strftime('%Y-%m-%d'),
                    'end': df.index.max().strftime('%Y-%m-%d')
                }
            }
        }

    def _get_prediction_context(self, ticker: str, period: str) -> Optional[Dict[str, Any]]:
        """Get prediction model availability context."""
        try:
            available_models = list_available_models()
            if not available_models:
                return None
            return {
                'available': True,
                'models_count': len(available_models),
                'note': 'Time-series prediction models available'
            }
        except Exception:
            return None

    def _get_technical_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate technical indicators."""
        try:
            df['MA20'] = df['Close'].rolling(window=20).mean()
            df['MA50'] = df['Close'].rolling(window=50).mean()
            df['MA200'] = df['Close'].rolling(window=200).mean()

            current_price = df['Close'].iloc[-1]
            ma20 = df['MA20'].iloc[-1] if not pd.isna(df['MA20'].iloc[-1]) else current_price
            ma50 = df['MA50'].iloc[-1] if not pd.isna(df['MA50'].iloc[-1]) else current_price
            ma200 = df['MA200'].iloc[-1] if not pd.isna(df['MA200'].iloc[-1]) else current_price

            rsi = self._calculate_rsi(df['Close'], period=14)
            ma_trend = "BULLISH" if current_price > ma20 > ma50 else "BEARISH" if current_price < ma20 < ma50 else "MIXED"

            recent_highs = df['High'].tail(50).nlargest(3).mean()
            recent_lows = df['Low'].tail(50).nsmallest(3).mean()

            return {
                'moving_averages': {
                    'ma20': float(ma20),
                    'ma50': float(ma50),
                    'ma200': float(ma200),
                    'trend': ma_trend,
                    'price_vs_ma20': float((current_price / ma20 - 1) * 100),
                    'price_vs_ma50': float((current_price / ma50 - 1) * 100)
                },
                'momentum': {
                    'rsi': float(rsi),
                    'rsi_signal': 'OVERBOUGHT' if rsi > 70 else 'OVERSOLD' if rsi < 30 else 'NEUTRAL'
                },
                'support_resistance': {
                    'resistance_level': float(recent_highs),
                    'support_level': float(recent_lows),
                    'distance_to_resistance': float((recent_highs / current_price - 1) * 100),
                    'distance_to_support': float((current_price / recent_lows - 1) * 100)
                }
            }
        except Exception as e:
            logger.warning(f"Technical analysis calculation error: {str(e)}")
            return {
                'error': str(e),
                'moving_averages': {},
                'momentum': {},
                'support_resistance': {}
            }

    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """Calculate Relative Strength Index."""
        try:
            delta = prices.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            return rsi.iloc[-1] if not pd.isna(rsi.iloc[-1]) else 50.0
        except Exception:
            return 50.0

    def _build_analysis_instruction(self, context: Dict[str, Any]) -> str:
        """
        Build comprehensive analysis instruction for the LLM.

        This instruction guides the LLM to produce a structured investment analysis
        incorporating all available data including news context.
        """
        company_info = context['financial_data']['company_info']
        price_action = context['financial_data']['price_action']
        technical = context['technical_analysis']
        news_context = context.get('news_context', {})

        market_cap = company_info.get('market_cap')
        market_cap_str = f"${market_cap:,.0f}" if market_cap else "N/A"

        instruction = f"""You are a professional financial analyst providing comprehensive investment research and analysis.

Your task is to analyze {context['ticker']} ({company_info.get('name')}) and provide a structured, data-driven investment assessment.

## ANALYSIS REQUIREMENTS

You MUST provide:
1. **Executive Summary** (2-4 paragraphs): High-level overview of investment thesis
2. **Sentiment Assessment**: Overall market sentiment (BULLISH/BEARISH/NEUTRAL) with confidence score and key drivers
3. **Technical Outlook**: Chart patterns, trend analysis, momentum indicators
4. **Fundamental Assessment**: Business strengths/weaknesses, valuation analysis
5. **Investment Recommendation**: Clear BUY/SELL/HOLD/WATCH with time horizon and detailed rationale
6. **Risk Factors**: Key risks to consider (technical, fundamental, macro, regulatory)
7. **Catalysts**: Potential price-moving events and their expected impact

## ANALYSIS PRINCIPLES

- **Data-Driven**: Base conclusions on the provided quantitative data and recent news
- **Objective**: Avoid speculation; acknowledge uncertainty where it exists
- **Actionable**: Provide clear entry/exit considerations
- **Educational**: This is for educational purposes only, not personalized investment advice
- **Grounded**: Reference specific data points and news events; do not fabricate information

## COMPANY OVERVIEW

Name: {company_info.get('name')}
Sector: {company_info.get('sector')}
Industry: {company_info.get('industry')}
Market: {company_info.get('market')} ({company_info.get('country')})
Market Cap: {market_cap_str}

## PRICE ACTION

Period: {price_action['data_points']} datapoints from {price_action['date_range']['start']} to {price_action['date_range']['end']}

Current Price: ${price_action['current_price']:.2f}
1-Month Return: {price_action['one_month_return']:+.2f}%
3-Month Return: {price_action['three_month_return']:+.2f}%
6-Month Return: {price_action['six_month_return']:+.2f}%
Annualized Volatility: {price_action['volatility']:.2f}%
Volume Trend (recent 10d vs average): {price_action['volume_trend']:+.2f}%

## TECHNICAL INDICATORS

Moving Averages:
- MA20: ${technical['moving_averages'].get('ma20', 0):.2f} (Price {technical['moving_averages'].get('price_vs_ma20', 0):+.2f}% vs MA20)
- MA50: ${technical['moving_averages'].get('ma50', 0):.2f} (Price {technical['moving_averages'].get('price_vs_ma50', 0):+.2f}% vs MA50)
- MA200: ${technical['moving_averages'].get('ma200', 0):.2f}
- Trend: {technical['moving_averages'].get('trend', 'UNKNOWN')}

Momentum:
- RSI (14-day): {technical['momentum'].get('rsi', 50):.1f} ({technical['momentum'].get('rsi_signal', 'NEUTRAL')})

Support & Resistance:
- Resistance Level: ${technical['support_resistance'].get('resistance_level', 0):.2f} ({technical['support_resistance'].get('distance_to_resistance', 0):+.2f}% from current)
- Support Level: ${technical['support_resistance'].get('support_level', 0):.2f} ({technical['support_resistance'].get('distance_to_support', 0):+.2f}% from current)

"""

        # Add news context if available
        company_headlines = news_context.get('company_headlines', [])
        macro_headlines = news_context.get('macro_headlines', [])

        if company_headlines or macro_headlines:
            instruction += "\n## NEWS CONTEXT\n\n"

        if company_headlines:
            from llm.schemas import NewsHeadline
            headlines = [NewsHeadline(**h) for h in company_headlines]
            formatted_news = format_news_for_prompt(headlines, max_headlines=5)
            instruction += f"### Recent Company News:\n{formatted_news}\n\n"

        if macro_headlines:
            from llm.schemas import NewsHeadline
            headlines = [NewsHeadline(**h) for h in macro_headlines]
            formatted_news = format_news_for_prompt(headlines, max_headlines=3)
            instruction += f"### Recent Market/Macro News:\n{formatted_news}\n\n"

        instruction += """
## OUTPUT FORMAT

Respond with a JSON object matching the FinancialAnalysisOutput schema. Ensure all required fields are present and properly formatted.

Focus on creating an investment analysis that synthesizes technical data, fundamental context, and recent news into actionable insights.
"""

        return instruction

    def _prepare_context_for_llm(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare context dict for LLM (exclude DataFrame, format for JSON).
        """
        prepared = {
            'ticker': context['ticker'],
            'company_info': context['financial_data']['company_info'],
            'price_action': context['financial_data']['price_action'],
            'technical_analysis': context['technical_analysis'],
            'predictions': context.get('predictions'),
            'news_available': {
                'company': context.get('news_context', {}).get('company_count', 0) > 0,
                'macro': context.get('news_context', {}).get('macro_count', 0) > 0
            }
        }
        return prepared

    def _format_analysis_response(
        self,
        structured_output: FinancialAnalysisOutput,
        ticker: str,
        period: str,
        total_processing_time_ms: float,
        llm_duration_ms: int,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Format structured output into API response format.

        Maintains backward compatibility while adding new structured fields.
        """
        # Convert structured output to dict
        output_dict = structured_output.model_dump()

        # Build metadata
        metadata = {
            'ticker': ticker.upper(),
            'analysis_timestamp': datetime.now().isoformat(),
            'data_period': period,
            'llm_model': self.settings.llm_model,
            'processing_time_ms': int(total_processing_time_ms),
            'llm_duration_ms': llm_duration_ms,
            'data_sources': context.get('metadata', {}).get('data_sources', {
                'financial_data': True,
                'technical_analysis': True,
                'predictions': context.get('predictions') is not None,
                'news_company': len(context.get('news_context', {}).get('company_headlines', [])) > 0,
                'news_macro': len(context.get('news_context', {}).get('macro_headlines', [])) > 0
            })
        }

        # Extract news from context (not from LLM output, as news is context input not output)
        news_context = context.get('news_context', {})
        company_headlines = news_context.get('company_headlines', [])
        macro_headlines = news_context.get('macro_headlines', [])

        # Format response with backward-compatible fields
        response = {
            # New structured fields
            'structured_analysis': output_dict,

            # Backward-compatible fields (for existing API consumers)
            'executive_summary': output_dict.get('executive_summary', ''),
            'sentiment_analysis': {
                'label': output_dict.get('sentiment', {}).get('label'),
                'confidence': output_dict.get('sentiment', {}).get('confidence'),
                'drivers': output_dict.get('sentiment', {}).get('drivers', []),
                'full_text': output_dict.get('executive_summary', '')  # Legacy field
            },
            'technical_outlook': output_dict.get('technical_outlook', {}).get('summary', ''),
            'fundamental_assessment': output_dict.get('fundamental_assessment', {}).get('summary', ''),
            'investment_recommendation': output_dict.get('recommendation', {}),
            'risks': output_dict.get('risks', []),
            'catalysts': output_dict.get('catalysts', []),

            # News context from enrichment (not LLM output)
            'news_context': company_headlines,
            'macro_context': macro_headlines,

            # Full analysis text (for legacy consumers)
            'analysis_text': output_dict.get('executive_summary', ''),

            # Metadata
            'metadata': metadata
        }

        return response
