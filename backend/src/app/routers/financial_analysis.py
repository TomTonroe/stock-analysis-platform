"""
Financial Analysis Endpoints

Includes: prediction models, predictions, and sentiment analysis.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any
from sqlalchemy.orm import Session

from database import get_db
from app.schemas import APIResponse
from data.financial_stocks_loader import resolve_ticker, get_ticker_info
from models.model_factory import predict_with_model, list_available_models
from services.cache_service import get_cache_service
from llm.client import llm_client
from llm.extensions.financial_sentiment import FinancialSentimentAnalyzer
from config.settings import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/financial", tags=["financial"])
settings = get_settings()


class PredictionRequest(BaseModel):
    ticker: str
    model: str = "chronos-bolt-small"
    forecast_days: int = 30
    period: str = "2y"


@router.get("/models", response_model=APIResponse)
async def get_available_models():
    models_data = {"models": list_available_models(), "default": "chronos-bolt-small"}
    return APIResponse.success_response(
        data=models_data, message=f"Found {len(models_data['models'])} available models"
    )


@router.post("/predict", response_model=APIResponse)
async def predict_stock(request: PredictionRequest, db: Session = Depends(get_db)):
    try:
        ticker_info = resolve_ticker(request.ticker)
        if not ticker_info.get("valid"):
            raise HTTPException(status_code=404, detail=f"Invalid ticker: {request.ticker}")

        result = predict_with_model(
            model_name=request.model,
            ticker=ticker_info["symbol"],
            forecast_days=request.forecast_days,
            period=request.period,
            db=db,
        )

        prediction_data = {
            "ticker": result["ticker"],
            "company_name": ticker_info["name"],
            "model_name": result["model_name"],
            "forecast_dates": result["forecast_dates"],
            "forecast_prices": result["forecast_prices"],
            "confidence_lower": result["confidence_lower"],
            "confidence_upper": result["confidence_upper"],
            "metrics": result["metrics"],
        }
        logger.info(
            "prediction %s model=%s days=%s",
            ticker_info["symbol"],
            request.model,
            request.forecast_days,
        )
        return APIResponse.success_response(
            data=prediction_data,
            message=f"Prediction completed for {ticker_info['name']} using {result['model_name']}",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.get("/sentiment/{ticker}", response_model=APIResponse)
async def get_stock_sentiment(
    ticker: str, period: str = "2y", include_predictions: bool = True, db: Session = Depends(get_db)
):
    try:
        ticker_info = get_ticker_info(ticker, db)
        if ticker_info.get("error"):
            raise HTTPException(status_code=404, detail=f"Invalid ticker: {ticker}")

        cache_service = get_cache_service(db)
        model_name = settings.llm_model
        cached_sentiment = cache_service.get_sentiment_analysis(ticker, period, model_name)

        if cached_sentiment:
            response_data = {
                "ticker": ticker_info["symbol"],
                "company_name": ticker_info.get("longName", ticker),
                "analysis_timestamp": cached_sentiment["metadata"]["analysis_timestamp"],
                "sentiment_analysis": cached_sentiment.get("sentiment_analysis", {}),
                "metadata": cached_sentiment["metadata"],
                "disclaimer": "This analysis is for educational purposes only and not investment advice. Always conduct your own research before making investment decisions.",
            }
            logger.debug("sentiment cache hit %s", ticker_info["symbol"])
            return APIResponse.success_response(
                data=response_data,
                message=f"Cached AI sentiment analysis for {ticker_info.get('longName', ticker)}",
            )

        analyzer = FinancialSentimentAnalyzer(llm_client)
        analysis_result = analyzer.analyze_stock_sentiment(
            ticker=ticker_info["symbol"],
            period=period,
            include_predictions=include_predictions,
            db=db,
        )

        if "error" in analysis_result:
            raise HTTPException(
                status_code=500, detail=f"Sentiment analysis failed: {analysis_result['error']}"
            )

        response_data = {
            "ticker": ticker_info["symbol"],
            "company_name": ticker_info.get("longName", ticker),
            "analysis_timestamp": analysis_result["metadata"]["analysis_timestamp"],
            "sentiment_analysis": {
                "executive_summary": analysis_result.get("executive_summary", ""),
                "sentiment_analysis": analysis_result.get("sentiment_analysis", ""),
                "technical_outlook": analysis_result.get("technical_outlook", ""),
                "fundamental_assessment": analysis_result.get("fundamental_assessment", ""),
                "investment_recommendation": analysis_result.get("investment_recommendation", ""),
                "full_analysis": analysis_result.get("analysis_text", ""),
            },
            "metadata": analysis_result["metadata"],
            "disclaimer": "This analysis is for educational purposes only and not investment advice. Always conduct your own research before making investment decisions.",
        }

        processing_time = analysis_result["metadata"].get("processing_time_ms")
        analysis_id = cache_service.set_sentiment_analysis(
            ticker, period, model_name, response_data, processing_time
        )
        if analysis_id:
            # Include analysis_id for chat linking
            response_data.setdefault("metadata", {})
            response_data["metadata"]["analysis_id"] = analysis_id
        logger.info("sentiment cached %s period=%s", ticker_info["symbol"], period)

        return APIResponse.success_response(
            data=response_data,
            message=f"AI sentiment analysis completed for {ticker_info.get('LongName', ticker)}",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")
