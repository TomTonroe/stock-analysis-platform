"""
WebSocket streaming endpoints for real-time financial data using yfinance WebSocket.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
import yfinance as yf

from data.financial_stocks_loader import get_ticker_info
from database import get_db


logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


class StreamingManager:
    """Manages active WebSocket connections and yfinance streaming."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.yf_websockets: Dict[str, yf.AsyncWebSocket] = {}
        self.streaming_tasks: Dict[str, asyncio.Task] = {}

    async def connect(self, websocket: WebSocket, ticker: str):
        await websocket.accept()
        self.active_connections[ticker] = websocket

    def disconnect(self, ticker: str):
        if ticker in self.active_connections:
            del self.active_connections[ticker]
        if ticker in self.streaming_tasks:
            task = self.streaming_tasks[ticker]
            if not task.done():
                task.cancel()
            del self.streaming_tasks[ticker]
        if ticker in self.yf_websockets:
            del self.yf_websockets[ticker]

    async def start_streaming(self, ticker: str):
        if ticker in self.streaming_tasks:
            return
        task = asyncio.create_task(self._stream_ticker_data(ticker))
        self.streaming_tasks[ticker] = task

    async def _stream_ticker_data(self, ticker: str):
        try:
            market_info = get_market_info(ticker)

            def message_handler(message):
                if ticker in self.active_connections:
                    processed_message = self._process_yfinance_message(message, ticker)
                    if processed_message:
                        asyncio.create_task(self._send_message_to_client(ticker, processed_message))

            async with yf.AsyncWebSocket() as ws:
                self.yf_websockets[ticker] = ws
                await ws.subscribe([ticker])
                serializable_market_info = {**market_info, "timezone": str(market_info["timezone"])}
                start_message = {
                    "source": "system_message",
                    "streaming_available": True,
                    "message": f"Connected to live data feed for {ticker}",
                    "reason": "connected_to_yahoo_finance",
                    "market_info": serializable_market_info,
                }
                await self._send_message_to_client(ticker, start_message)
                await ws.listen(message_handler)

        except Exception as e:
            logger.error("WebSocket streaming error for %s: %s", ticker, e)
            market_info = get_market_info(ticker)
            serializable_market_info = {**market_info, "timezone": str(market_info["timezone"])}
            error_message = {
                "source": "system_message",
                "streaming_available": False,
                "message": f"Live streaming connection failed: {str(e)}",
                "reason": "yahoo_finance_connection_error",
                "market_info": serializable_market_info,
            }
            if ticker in self.active_connections:
                await self._send_message_to_client(ticker, error_message)

    def _process_yfinance_message(self, message: dict, ticker: str):
        try:
            last_price_fields = [
                message.get("price"),
                message.get("last"),
                message.get("close"),
                message.get("regularMarketPrice"),
            ]
            last_price = next(
                (p for p in last_price_fields if isinstance(p, (int, float)) and p), None
            )
            if last_price is None:
                return None
            current_price = float(last_price)
            day_volume = str(message.get("day_volume") or message.get("volume") or "0")
            volume = int(day_volume) if day_volume.isdigit() else 0
            change = message.get("change", 0)
            change_percent = message.get("change_percent", 0)
            timestamp_ms = message.get("time")
            if timestamp_ms:
                timestamp = datetime.fromtimestamp(int(timestamp_ms) / 1000, timezone.utc)
            else:
                timestamp = datetime.now(timezone.utc)
            candle_start = timestamp.replace(
                second=timestamp.second - (timestamp.second % 10), microsecond=0
            )
            return {
                "open": current_price,
                "high": current_price,
                "low": current_price,
                "close": current_price,
                "volume": volume,
                "change": round(change, 4),
                "change_percent": round(change_percent, 4),
                "timestamp": timestamp.isoformat(),
                "candle_start": candle_start.isoformat(),
                "source": "yahoo_finance_websocket",
                "market_hours": message.get("market_hours", 0) == 1,
                "last_size": message.get("last_size", "0"),
            }
        except Exception as e:
            logger.exception("Error processing yfinance message for %s: %s", ticker, e)
            return None

    async def _send_message_to_client(self, ticker: str, message: dict):
        if ticker in self.active_connections:
            try:
                websocket = self.active_connections[ticker]
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error("Error sending message to client for %s: %s", ticker, e)
                self.disconnect(ticker)


streaming_manager = StreamingManager()


def get_market_info(ticker: str) -> dict:
    market_configs = {
        "US": {
            "timezone": timezone(timedelta(hours=-5)),
            "market_open": (9, 30),
            "market_close": (16, 0),
            "name": "US Stock Market",
            "suffixes": ["", ".US"],
        },
        "ASX": {
            "timezone": timezone(timedelta(hours=10)),
            "market_open": (10, 0),
            "market_close": (16, 0),
            "name": "Australian Securities Exchange",
            "suffixes": [".AX"],
        },
        "TSX": {
            "timezone": timezone(timedelta(hours=-5)),
            "market_open": (9, 30),
            "market_close": (16, 0),
            "name": "Toronto Stock Exchange",
            "suffixes": [".TO"],
        },
    }
    ticker_upper = ticker.upper()
    for market_code, config in market_configs.items():
        for suffix in config["suffixes"]:
            if suffix and ticker_upper.endswith(suffix):
                return {**config, "code": market_code}
    return {**market_configs["US"], "code": "US"}


def is_market_open(ticker: str) -> tuple[bool, str, dict]:
    market_info = get_market_info(ticker)
    now = datetime.now(market_info["timezone"])
    weekday = now.weekday()
    if weekday >= 5:
        return False, f"{market_info['name']} is closed on weekends", market_info
    open_hour, open_minute = market_info["market_open"]
    close_hour, close_minute = market_info["market_close"]
    market_open = now.replace(hour=open_hour, minute=open_minute, second=0, microsecond=0)
    market_close = now.replace(hour=close_hour, minute=close_minute, second=0, microsecond=0)
    if now < market_open:
        return False, f"{market_info['name']} opens at {open_hour}:{open_minute:02d}", market_info
    elif now > market_close:
        return (
            False,
            f"{market_info['name']} closed at {close_hour}:{close_minute:02d}",
            market_info,
        )
    else:
        return True, "Market is open", market_info


@router.websocket("/ws/{ticker}")
async def websocket_endpoint(websocket: WebSocket, ticker: str, db: Session = Depends(get_db)):
    ticker_info = get_ticker_info(ticker, db)
    if ticker_info.get("error"):
        await websocket.accept()
        await websocket.close(code=1008)
        return
    await streaming_manager.connect(websocket, ticker)
    try:
        await streaming_manager.start_streaming(ticker)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        streaming_manager.disconnect(ticker)
