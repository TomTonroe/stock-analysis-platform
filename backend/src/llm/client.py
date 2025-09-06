"""
LLM Client with extensible task system.

This file was migrated from core.llm.client to llm.client
"""

from __future__ import annotations
import requests
import json
from typing import Any, Dict, List, Optional
from time import time, sleep
from config.settings import get_settings


class LLMClient:
    def __init__(self):
        self.settings = get_settings()
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.default_model = "openai/gpt-oss-120b:free"

    def call(
        self,
        task: str,
        prompt: Optional[str] = None,
        model: Optional[str] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        if self.settings.llm_provider == "mock":
            return {
                "task": task,
                "output": f"[MOCK:{task}] {(prompt or '[no-prompt]')[:60]}...",
                "model": model or self.default_model,
                "usage": {"total_tokens": 0},
            }
        elif self.settings.llm_provider == "openrouter":
            return self._call_openrouter(task, prompt, model, messages=messages, **kwargs)
        else:
            return {
                "task": task,
                "output": f"[ERROR] Unknown provider: {self.settings.llm_provider}",
            }

    def _call_openrouter(
        self,
        task: str,
        prompt: Optional[str] = None,
        model: Optional[str] = None,
        messages: Optional[List[Dict[str, str]]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        if not self.settings.openrouter_api_key:
            return {"task": task, "output": "[ERROR] OpenRouter API key not configured"}
        model_name = model or self.default_model
        headers = {
            "Authorization": f"Bearer {self.settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/TomTonroe/stock-analysis-platform",
            "X-Title": "Stock Analysis Platform",
        }
        body_messages = messages if messages is not None else self._create_messages(task, prompt or "")
        payload = {
            "model": model_name,
            "messages": body_messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 500),
        }
        # simple retry for 429/5xx
        attempts = 0
        max_attempts = 3
        backoff = 0.75
        while attempts < max_attempts:
            attempts += 1
            start = time()
            try:
                response = requests.post(
                    self.base_url, headers=headers, data=json.dumps(payload), timeout=30
                )
                duration_ms = int((time() - start) * 1000)
                if response.status_code == 200:
                    result = response.json()
                    content = result["choices"][0]["message"]["content"]
                    return {
                        "task": task,
                        "output": content,
                        "model": model_name,
                        "usage": result.get("usage", {}),
                        "request_id": result.get("id"),
                        "duration_ms": duration_ms,
                    }
                elif response.status_code in (429, 500, 502, 503, 504) and attempts < max_attempts:
                    sleep(backoff)
                    backoff *= 2
                    continue
                else:
                    error_msg = f"OpenRouter API error: {response.status_code}"
                    if response.text:
                        error_msg += f" - {response.text}"
                    return {"task": task, "output": f"[ERROR] {error_msg}", "duration_ms": duration_ms}
            except requests.exceptions.Timeout:
                if attempts >= max_attempts:
                    return {"task": task, "output": "[ERROR] Request timed out"}
                sleep(backoff)
                backoff *= 2
            except requests.exceptions.ConnectionError:
                if attempts >= max_attempts:
                    return {"task": task, "output": "[ERROR] Connection failed"}
                sleep(backoff)
                backoff *= 2
            except Exception as e:
                return {"task": task, "output": f"[ERROR] {str(e)}"}

    def _create_messages(self, task: str, prompt: str) -> list[Dict[str, str]]:
        if task == "financial_sentiment":
            return self._handle_financial_sentiment_task(prompt)
        elif task == "sentiment_chat":
            return self._handle_sentiment_chat_task(prompt)
        else:
            system_msg = "You are a helpful AI assistant."
            user_msg = f"Task: {task}\n\n{prompt}"
        return [{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}]

    def _handle_financial_sentiment_task(self, prompt: str) -> list[Dict[str, str]]:
        system_msg = """You are a professional financial analyst with expertise in investment research and market analysis.
Provide objective, data-driven analysis based on quantitative metrics."""
        user_msg = prompt
        return [{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}]

    def _handle_sentiment_chat_task(self, prompt: str) -> list[Dict[str, str]]:
        """Handle sentiment analysis chat conversations."""
        system_msg = (
            "You are an expert financial analyst AI discussing a prior sentiment analysis. "
            "Provide educational insights, reference prior analysis, and maintain a professional tone. "
        )
        user_msg = prompt
        return [{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}]


llm_client = LLMClient()
