"""
Financial Sentiment Analysis Extension (migrated from core.llm.extensions).
"""

import json
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional

from data.financial_stocks_loader import load_financial_stocks_data, get_ticker_info
from models.model_factory import list_available_models


class FinancialSentimentAnalyzer:
    def __init__(self, llm_client):
        self.llm_client = llm_client

    def analyze_stock_sentiment(self, ticker: str, period: str = "2y", include_predictions: bool = True, db=None) -> Dict[str, Any]:
        try:
            financial_data = self._get_financial_context(ticker, period, db)
            prediction_data = self._get_prediction_context(ticker, period) if include_predictions else None
            technical_data = self._get_technical_analysis(financial_data['price_df'])
            analysis_prompt = self._build_analysis_prompt({
                'ticker': ticker.upper(),
                'financial_data': financial_data,
                'technical_analysis': technical_data,
                'predictions': prediction_data
            })
            result = self.llm_client.call(task="financial_sentiment", prompt=analysis_prompt, model="openai/gpt-oss-120b:free", max_tokens=1500, temperature=0.1)
            analysis = self._parse_financial_analysis(result)
            analysis['metadata'] = {
                'ticker': ticker.upper(),
                'analysis_timestamp': datetime.now().isoformat(),
                'data_period': period,
                'llm_model': result.get('model', 'unknown'),
                'processing_time_ms': result.get('usage', {}).get('total_tokens', 0),
                'data_sources': {
                    'financial_data': True,
                    'technical_analysis': True,
                    'predictions': prediction_data is not None,
                    'news_data': False
                }
            }
            return analysis
        except Exception as e:
            return {'error': str(e), 'ticker': ticker.upper(), 'analysis_timestamp': datetime.now().isoformat()}

    def _get_financial_context(self, ticker: str, period: str, db=None) -> Dict[str, Any]:
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
                'date_range': {'start': df.index.min().strftime('%Y-%m-%d'), 'end': df.index.max().strftime('%Y-%m-%d')}
            }
        }

    def _get_prediction_context(self, ticker: str, period: str) -> Optional[Dict[str, Any]]:
        try:
            available_models = list_available_models()
            if not available_models:
                return None
            return {'available': True, 'models_count': len(available_models), 'note': 'Prediction integration available via /financial/predict endpoint'}
        except Exception:
            return None

    def _get_technical_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
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
                    'ma20': float(ma20), 'ma50': float(ma50), 'ma200': float(ma200), 'trend': ma_trend,
                    'price_vs_ma20': float((current_price / ma20 - 1) * 100), 'price_vs_ma50': float((current_price / ma50 - 1) * 100)
                },
                'momentum': {'rsi': float(rsi), 'rsi_signal': 'OVERBOUGHT' if rsi > 70 else 'OVERSOLD' if rsi < 30 else 'NEUTRAL'},
                'support_resistance': {
                    'resistance_level': float(recent_highs), 'support_level': float(recent_lows),
                    'distance_to_resistance': float((recent_highs / current_price - 1) * 100),
                    'distance_to_support': float((current_price / recent_lows - 1) * 100)
                }
            }
        except Exception as e:
            return {'error': str(e), 'moving_averages': {}, 'momentum': {}, 'support_resistance': {}}

    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        try:
            delta = prices.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            return rsi.iloc[-1] if not pd.isna(rsi.iloc[-1]) else 50.0
        except Exception:
            return 50.0

    def _build_analysis_prompt(self, data: Dict) -> str:
        company_info = data['financial_data']['company_info']
        price_action = data['financial_data']['price_action']
        technical = data['technical_analysis']
        market_cap = company_info.get('market_cap')
        market_cap_str = f"${market_cap:,.0f}" if market_cap else "N/A"
        prompt = f"""You are a professional financial analyst providing investment research. Analyze the following data for {data['ticker']} and provide a structured investment analysis.

**COMPANY OVERVIEW:**
Name: {company_info.get('name')}
Sector: {company_info.get('sector')}
Industry: {company_info.get('industry')}
Market: {company_info.get('market')} ({company_info.get('country')})
Market Cap: {market_cap_str}

**PRICE ACTION (last {price_action['data_points']} datapoints):**
Current Price: ${price_action['current_price']:.2f}
1M Return: {price_action['one_month_return']:+.2f}%
3M Return: {price_action['three_month_return']:+.2f}%
6M Return: {price_action['six_month_return']:+.2f}%
Annualized Volatility: {price_action['volatility']:.2f}%
Volume Trend (10d vs avg): {price_action['volume_trend']:+.2f}%
Date Range: {price_action['date_range']['start']} to {price_action['date_range']['end']}

**TECHNICAL ANALYSIS:**
MA20: ${technical['moving_averages']['ma20']:.2f}, MA50: ${technical['moving_averages']['ma50']:.2f}, MA200: ${technical['moving_averages']['ma200']:.2f}
Price vs MA20: {technical['moving_averages']['price_vs_ma20']:+.2f}%
Price vs MA50: {technical['moving_averages']['price_vs_ma50']:+.2f}%
Trend: {technical['moving_averages']['trend']}
RSI: {technical['momentum']['rsi']:.1f} ({technical['momentum']['rsi_signal']})
Resistance: ${technical['support_resistance']['resistance_level']:.2f}
Support: ${technical['support_resistance']['support_level']:.2f}
Distance to Resistance: {technical['support_resistance']['distance_to_resistance']:+.2f}%
Distance to Support: {technical['support_resistance']['distance_to_support']:+.2f}%

**PREDICTIONS (if available):**
{json.dumps(data['predictions'] or {'available': False}, indent=2)}

Provide:
- Executive summary
- Sentiment analysis (bullish/bearish/neutral) with reasoning
- Technical outlook
- Fundamental assessment
- Investment recommendation with time horizon
"""
        return prompt

    def _parse_financial_analysis(self, llm_result: Dict[str, Any]) -> Dict[str, Any]:
        text = llm_result.get('output', '')
        return {
            'executive_summary': text[:400],
            'sentiment_analysis': text,
            'technical_outlook': '',
            'fundamental_assessment': '',
            'investment_recommendation': '',
            'analysis_text': text
        }

