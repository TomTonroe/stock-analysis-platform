"""
LLM Client with extensible task system.

This file was migrated from core.llm.client to llm.client
"""

from __future__ import annotations
import requests
import json
from typing import Any, Dict
from config.settings import get_settings


class LLMClient:
    def __init__(self):
        self.settings = get_settings()
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.default_model = "openai/gpt-oss-120b:free"

    def call(self, task: str, prompt: str, model: str = None, **kwargs) -> Dict[str, Any]:
        if self.settings.llm_provider == "mock":
            return {"task": task, "output": f"[MOCK:{task}] {prompt[:60]}..."}
        elif self.settings.llm_provider == "openrouter":
            return self._call_openrouter(task, prompt, model, **kwargs)
        else:
            return {
                "task": task,
                "output": f"[ERROR] Unknown provider: {self.settings.llm_provider}",
            }

    def _call_openrouter(
        self, task: str, prompt: str, model: str = None, **kwargs
    ) -> Dict[str, Any]:
        if not self.settings.openrouter_api_key:
            return {"task": task, "output": "[ERROR] OpenRouter API key not configured"}
        model_name = model or self.default_model
        try:
            headers = {
                "Authorization": f"Bearer {self.settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/TomTonroe/stock-analysis-platform",
                "X-Title": "Stock Analysis Platform",
            }
            messages = self._create_messages(task, prompt)
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": kwargs.get("temperature", 0.7),
                "max_tokens": kwargs.get("max_tokens", 500),
            }
            response = requests.post(
                self.base_url, headers=headers, data=json.dumps(payload), timeout=30
            )
            if response.status_code == 200:
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                return {
                    "task": task,
                    "output": content,
                    "model": model_name,
                    "usage": result.get("usage", {}),
                }
            else:
                error_msg = f"OpenRouter API error: {response.status_code}"
                if response.text:
                    error_msg += f" - {response.text}"
                return {"task": task, "output": f"[ERROR] {error_msg}"}
        except requests.exceptions.Timeout:
            return {"task": task, "output": "[ERROR] Request timed out"}
        except requests.exceptions.ConnectionError:
            return {"task": task, "output": "[ERROR] Connection failed"}
        except Exception as e:
            return {"task": task, "output": f"[ERROR] {str(e)}"}

    def _create_messages(self, task: str, prompt: str) -> list[Dict[str, str]]:
        if task == "financial_sentiment":
            return self._handle_financial_sentiment_task(prompt)
        else:
            system_msg = "You are a helpful AI assistant."
            user_msg = f"Task: {task}\n\n{prompt}"
        return [{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}]

    def _handle_financial_sentiment_task(self, prompt: str) -> list[Dict[str, str]]:
        system_msg = """You are a professional financial analyst with expertise in investment research and market analysis.
Provide objective, data-driven analysis based on quantitative metrics."""
        user_msg = prompt
        return [{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}]


llm_client = LLMClient()
