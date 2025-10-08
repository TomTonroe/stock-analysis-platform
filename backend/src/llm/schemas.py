"""
Pydantic schemas for structured LLM outputs.

These models define the expected structure for financial sentiment analysis,
ensuring type-safe, validated, and parseable AI-generated content.
"""

from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


class NewsHeadline(BaseModel):
    """A news headline with metadata."""

    title: str = Field(..., description="Headline title")
    source: Optional[str] = Field(None, description="News source name")
    url: Optional[str] = Field(None, description="Article URL")
    published_at: Optional[str] = Field(None, description="Publication date (ISO format)")
    relevance_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Relevance to ticker (0-1)")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Apple announces new iPhone with AI features",
                "source": "Reuters",
                "url": "https://reuters.com/...",
                "published_at": "2025-01-15T10:30:00Z",
                "relevance_score": 0.95
            }
        }


class SentimentScore(BaseModel):
    """Overall sentiment assessment."""

    label: Literal["BULLISH", "BEARISH", "NEUTRAL"] = Field(
        ...,
        description="Overall market sentiment for the security"
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence in sentiment assessment (0-1)"
    )
    drivers: List[str] = Field(
        default_factory=list,
        max_length=5,
        description="Top 3-5 key factors driving this sentiment"
    )

    @field_validator('drivers')
    @classmethod
    def validate_drivers(cls, v):
        if len(v) > 5:
            return v[:5]
        return v


class TechnicalOutlook(BaseModel):
    """Technical analysis summary."""

    summary: str = Field(..., max_length=500, description="Technical analysis overview")
    trend: Literal["BULLISH", "BEARISH", "MIXED", "NEUTRAL"] = Field(
        ...,
        description="Current technical trend"
    )
    key_levels: Optional[dict] = Field(
        None,
        description="Important support/resistance levels"
    )
    momentum_indicators: Optional[str] = Field(
        None,
        max_length=300,
        description="RSI, MACD, and other momentum indicator summary"
    )


class FundamentalAssessment(BaseModel):
    """Fundamental analysis summary."""

    summary: str = Field(..., max_length=500, description="Fundamental analysis overview")
    strengths: List[str] = Field(
        default_factory=list,
        max_length=4,
        description="Key fundamental strengths"
    )
    weaknesses: List[str] = Field(
        default_factory=list,
        max_length=4,
        description="Key fundamental weaknesses"
    )
    valuation_assessment: Optional[str] = Field(
        None,
        max_length=200,
        description="Valuation summary (overvalued/undervalued/fair)"
    )


class InvestmentRecommendation(BaseModel):
    """Clear investment recommendation with rationale."""

    action: Literal["BUY", "SELL", "HOLD", "WATCH"] = Field(
        ...,
        description="Investment action recommendation"
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence in recommendation (0-1)"
    )
    time_horizon: Literal["SHORT_TERM", "MEDIUM_TERM", "LONG_TERM"] = Field(
        ...,
        description="Recommended investment time horizon"
    )
    rationale: str = Field(
        ...,
        max_length=600,
        description="2-3 sentence explanation of recommendation"
    )
    entry_considerations: Optional[str] = Field(
        None,
        max_length=300,
        description="Entry points or timing considerations"
    )
    exit_considerations: Optional[str] = Field(
        None,
        max_length=300,
        description="Exit points or conditions to reconsider"
    )


class RiskFactor(BaseModel):
    """A specific risk factor."""

    category: Literal["TECHNICAL", "FUNDAMENTAL", "MACRO", "NEWS", "REGULATORY", "OTHER"] = Field(
        ...,
        description="Risk category"
    )
    description: str = Field(..., max_length=300, description="Risk description")
    severity: Literal["LOW", "MEDIUM", "HIGH"] = Field(..., description="Risk severity")


class Catalyst(BaseModel):
    """A potential catalyst for price movement."""

    event: str = Field(..., max_length=200, description="Catalyst event description")
    expected_timing: Optional[str] = Field(None, max_length=100, description="When this might occur")
    potential_impact: Literal["POSITIVE", "NEGATIVE", "NEUTRAL"] = Field(
        ...,
        description="Expected impact direction"
    )


class FinancialAnalysisOutput(BaseModel):
    """Complete structured financial sentiment analysis output.

    This is the top-level schema that the LLM must produce,
    containing all sections of the analysis.
    """

    # Executive summary (high-level overview)
    executive_summary: str = Field(
        ...,
        min_length=100,
        max_length=2000,
        description="High-level summary of the analysis (2-4 paragraphs)"
    )

    # Core sentiment assessment
    sentiment: SentimentScore = Field(
        ...,
        description="Overall sentiment analysis with confidence and key drivers"
    )

    # Technical analysis
    technical_outlook: TechnicalOutlook = Field(
        ...,
        description="Technical analysis and chart patterns"
    )

    # Fundamental analysis
    fundamental_assessment: FundamentalAssessment = Field(
        ...,
        description="Fundamental analysis and business assessment"
    )

    # Investment recommendation
    recommendation: InvestmentRecommendation = Field(
        ...,
        description="Clear buy/sell/hold/watch recommendation with rationale"
    )

    # Risk factors
    risks: List[RiskFactor] = Field(
        default_factory=list,
        max_length=6,
        description="Key risk factors to consider (max 6)"
    )

    # Catalysts
    catalysts: List[Catalyst] = Field(
        default_factory=list,
        max_length=5,
        description="Potential catalysts for price movement (max 5)"
    )

    # NOTE: news_context and macro_context are NOT part of LLM output
    # They are added separately in the response formatting layer
    # The LLM receives news as INPUT context, not as a field to generate

    @field_validator('risks')
    @classmethod
    def validate_risks(cls, v):
        if len(v) > 6:
            return v[:6]
        return v

    @field_validator('catalysts')
    @classmethod
    def validate_catalysts(cls, v):
        if len(v) > 5:
            return v[:5]
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "executive_summary": "Apple (AAPL) shows strong technical momentum...",
                "sentiment": {
                    "label": "BULLISH",
                    "confidence": 0.75,
                    "drivers": ["Strong technical momentum", "New product launches", "Positive earnings"]
                },
                "technical_outlook": {
                    "summary": "Price trending above key moving averages...",
                    "trend": "BULLISH",
                    "key_levels": {"support": 175.0, "resistance": 185.0},
                    "momentum_indicators": "RSI at 62 (neutral), MACD showing bullish crossover"
                },
                "fundamental_assessment": {
                    "summary": "Strong fundamentals with solid revenue growth...",
                    "strengths": ["Market leadership", "Brand value", "Cash flow"],
                    "weaknesses": ["Regulatory pressure", "Market saturation"],
                    "valuation_assessment": "Trading at fair value based on P/E ratio"
                },
                "recommendation": {
                    "action": "BUY",
                    "confidence": 0.70,
                    "time_horizon": "MEDIUM_TERM",
                    "rationale": "Strong technical setup combined with solid fundamentals...",
                    "entry_considerations": "Consider entry on pullback to $175 support",
                    "exit_considerations": "Take profits near $185 resistance"
                },
                "risks": [
                    {
                        "category": "MACRO",
                        "description": "Rising interest rates could pressure valuations",
                        "severity": "MEDIUM"
                    }
                ],
                "catalysts": [
                    {
                        "event": "Q1 earnings release",
                        "expected_timing": "January 31, 2025",
                        "potential_impact": "POSITIVE"
                    }
                ]
            }
        }


class AnalysisMetadata(BaseModel):
    """Metadata about the analysis process."""

    ticker: str
    analysis_timestamp: str
    data_period: str
    llm_model: str
    processing_time_ms: int = 0
    data_sources: dict = Field(
        default_factory=lambda: {
            "financial_data": False,
            "technical_analysis": False,
            "predictions": False,
            "news_company": False,
            "news_macro": False
        }
    )