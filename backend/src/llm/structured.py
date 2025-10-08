"""
Structured LLM output generation using Pydantic models.

This module provides utilities for generating structured, validated outputs
from LLMs using Pydantic schemas for strict parsing.
"""

from __future__ import annotations
import json
import logging
from typing import Dict, Any, Optional, Type, TypeVar
from pydantic import BaseModel, ValidationError
from time import time

from config.settings import get_settings

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=BaseModel)


class StructuredGenerationResult:
    """Result of a structured generation attempt."""

    def __init__(
        self,
        success: bool,
        output: Optional[BaseModel] = None,
        raw_content: str = "",
        errors: Optional[list] = None,
        duration_ms: int = 0,
        attempts: int = 1
    ):
        self.success = success
        self.output = output
        self.raw_content = raw_content
        self.errors = errors or []
        self.duration_ms = duration_ms
        self.attempts = attempts


def build_structured_prompt(
    task_instruction: str,
    context_data: Dict[str, Any],
    schema_model: Type[BaseModel]
) -> str:
    """
    Build a prompt that instructs the LLM to generate structured JSON output.

    Args:
        task_instruction: High-level task description
        context_data: Dictionary of data to include in prompt (company info, prices, etc.)
        schema_model: Pydantic model defining expected output structure

    Returns:
        Formatted prompt string
    """
    # Generate JSON schema from Pydantic model
    schema_dict = schema_model.model_json_schema()
    schema_json = json.dumps(schema_dict, indent=2)

    prompt = f"""{task_instruction}

## CONTEXT DATA

{json.dumps(context_data, indent=2, default=str)}

## OUTPUT INSTRUCTIONS

You MUST respond with ONLY a valid JSON object that conforms to this schema:

```json
{schema_json}
```

IMPORTANT:
- Return ONLY the JSON object, no additional text
- Ensure all required fields are present
- Use exact enum values as specified in the schema
- Keep text lengths within specified max_length constraints
- Base your analysis on the provided context data

Begin your JSON response now:
"""
    return prompt


def parse_and_validate_json(
    raw_content: str,
    schema_model: Type[T]
) -> tuple[Optional[T], Optional[str]]:
    """
    Parse raw LLM output and validate against schema.

    Args:
        raw_content: Raw text response from LLM
        schema_model: Pydantic model to validate against

    Returns:
        Tuple of (parsed_object, error_message)
    """
    # Try to extract JSON from markdown code blocks
    content = raw_content.strip()

    # Remove markdown code fences if present
    if content.startswith("```json"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]

    if content.endswith("```"):
        content = content[:-3]

    content = content.strip()

    try:
        # Parse JSON
        data = json.loads(content)

        # Validate with Pydantic
        validated_obj = schema_model.model_validate(data)
        return validated_obj, None

    except json.JSONDecodeError as e:
        return None, f"JSON parsing error: {str(e)}"

    except ValidationError as e:
        errors = []
        for error in e.errors():
            field = ".".join(str(loc) for loc in error['loc'])
            errors.append(f"{field}: {error['msg']}")
        return None, f"Validation errors: {'; '.join(errors)}"

    except Exception as e:
        return None, f"Unexpected error: {str(e)}"


def generate_structured(
    llm_client,
    task_name: str,
    task_instruction: str,
    context_data: Dict[str, Any],
    schema_model: Type[T],
    model: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 2000,
) -> StructuredGenerationResult:
    """
    Generate structured LLM output with automatic validation and repair.

    This function:
    1. Builds a prompt that includes the JSON schema
    2. Calls the LLM
    3. Parses and validates the response
    4. Optionally attempts one repair if validation fails

    Args:
        llm_client: LLM client instance
        task_name: Task identifier for logging
        task_instruction: Instructions for the LLM
        context_data: Data to include in the prompt
        schema_model: Pydantic model defining output structure
        model: Model name override (optional)
        temperature: LLM temperature (lower = more deterministic)
        max_tokens: Maximum tokens in response
        max_repair_attempts: Number of repair attempts on validation failure

    Returns:
        StructuredGenerationResult with output or error details
    """
    settings = get_settings()
    start_time = time()

    # Handle mock provider with static structured output
    if settings.llm_provider == "mock":
        mock_output = _generate_mock_structured_output(schema_model, context_data)
        duration_ms = int((time() - start_time) * 1000)
        logger.info(f"[{task_name}] Mock structured output generated in {duration_ms}ms")
        return StructuredGenerationResult(
            success=True,
            output=mock_output,
            raw_content="[MOCK]",
            duration_ms=duration_ms,
            attempts=1
        )

    # Build prompt
    prompt = build_structured_prompt(task_instruction, context_data, schema_model)

    # Single call for POC simplicity
    result = llm_client.call(
        task=task_name,
        prompt=prompt,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    raw_content = result.get("output", "")
    duration_ms = result.get("duration_ms", 0)

    # Check for LLM errors
    if raw_content.startswith("[ERROR]"):
        logger.error(f"[{task_name}] LLM error: {raw_content}")
        return StructuredGenerationResult(
            success=False,
            raw_content=raw_content,
            errors=[raw_content],
            duration_ms=duration_ms,
            attempts=1,
        )

    # Parse and validate
    parsed_obj, error_msg = parse_and_validate_json(raw_content, schema_model)
    total_duration = int((time() - start_time) * 1000)

    if parsed_obj:
        logger.info(f"[{task_name}] Structured output generated in {total_duration}ms")
        return StructuredGenerationResult(
            success=True,
            output=parsed_obj,
            raw_content=raw_content,
            duration_ms=total_duration,
            attempts=1,
        )

    logger.error(f"[{task_name}] Validation failed: {error_msg}")
    return StructuredGenerationResult(
        success=False,
        raw_content=raw_content,
        errors=[error_msg],
        duration_ms=total_duration,
        attempts=1,
    )


def _generate_mock_structured_output(
    schema_model: Type[T],
    context_data: Dict[str, Any]
) -> T:
    """
    Generate a mock structured output for testing without LLM.

    Generates plausible output based on actual price data, making it more realistic.
    """
    # Import here to avoid circular dependency
    from llm.schemas import FinancialAnalysisOutput, SentimentScore, TechnicalOutlook
    from llm.schemas import FundamentalAssessment, InvestmentRecommendation
    from llm.schemas import RiskFactor, Catalyst

    ticker = context_data.get("ticker", "UNKNOWN")

    if schema_model == FinancialAnalysisOutput:
        # Extract price action data to generate realistic sentiment
        price_action = context_data.get("price_action", {})
        technical = context_data.get("technical_analysis", {})

        # Determine sentiment based on actual returns
        one_month = price_action.get("one_month_return", 0)
        three_month = price_action.get("three_month_return", 0)

        if one_month > 5 and three_month > 10:
            label, conf = "BULLISH", 0.75
            drivers = [f"Strong 3M return ({three_month:.1f}%)", f"Positive 1M momentum ({one_month:.1f}%)", "Upward trend"]
            action = "BUY"
            rationale = f"[MOCK] {ticker} shows strong momentum. Technical indicators support continuation."
        elif one_month < -5 and three_month < -10:
            label, conf = "BEARISH", 0.72
            drivers = [f"Negative 3M return ({three_month:.1f}%)", f"Decline ({one_month:.1f}% 1M)", "Downward pressure"]
            action = "SELL"
            rationale = f"[MOCK] {ticker} faces downward pressure. Consider reducing exposure."
        else:
            label, conf = "NEUTRAL", 0.65
            drivers = ["Mixed price action", f"3M return: {three_month:.1f}%", "Consolidation pattern"]
            action = "HOLD"
            rationale = f"[MOCK] {ticker} shows mixed signals. Wait for clearer direction."

        current_price = price_action.get("current_price", 100)
        ma_trend = technical.get("moving_averages", {}).get("trend", "MIXED")
        rsi = technical.get("momentum", {}).get("rsi", 50)

        return FinancialAnalysisOutput(
            executive_summary=f"[MOCK] {ticker} at ${current_price:.2f} with {one_month:+.1f}% 1M, {three_month:+.1f}% 3M returns. "
                              f"{ma_trend.capitalize()} trend, RSI {rsi:.1f}. Mock analysis based on real data for testing.",
            sentiment=SentimentScore(label=label, confidence=conf, drivers=drivers),
            technical_outlook=TechnicalOutlook(
                summary=f"${current_price:.2f} with {ma_trend.lower()} MA alignment, RSI {rsi:.1f}",
                trend=ma_trend,
                key_levels={"support": current_price * 0.92, "resistance": current_price * 1.08},
                momentum_indicators=f"RSI {rsi:.1f}, {label.lower()} bias"
            ),
            fundamental_assessment=FundamentalAssessment(
                summary=f"[MOCK] {ticker} fundamentals stable (mock assessment)",
                strengths=["Market presence", "History"],
                weaknesses=["Market risks", "Competition"],
                valuation_assessment="Mock - fundamentals not analyzed"
            ),
            recommendation=InvestmentRecommendation(
                action=action, confidence=conf, time_horizon="MEDIUM_TERM", rationale=rationale,
                entry_considerations=f"Entry near ${current_price * 0.95:.2f}",
                exit_considerations=f"Exit near ${current_price * 1.05:.2f}"
            ),
            risks=[
                RiskFactor(category="TECHNICAL", description=f"Volatility {price_action.get('volatility', 30):.1f}%", severity="MEDIUM"),
                RiskFactor(category="MACRO", description="Market conditions", severity="MEDIUM")
            ],
            catalysts=[
                Catalyst(event="Earnings report", expected_timing="Next quarter", potential_impact="NEUTRAL"),
                Catalyst(event="Trend continuation", expected_timing="Near term", potential_impact="POSITIVE" if label == "BULLISH" else "NEGATIVE" if label == "BEARISH" else "NEUTRAL")
            ]
        )

    raise ValueError(f"No mock implementation for {schema_model.__name__}")
