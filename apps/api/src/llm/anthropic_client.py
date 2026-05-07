"""Thin wrappers around the Anthropic SDK.

The agent graph uses non-streaming `complete_json` for structured outputs
(orchestrator decisions, evaluator scores, reporter sections). The route
layer uses `stream_text` to deliver the interviewer's question and the
final report token-by-token to the SSE client.
"""
from __future__ import annotations

import json
import logging
import re
from collections.abc import AsyncIterator

from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

# Conservative cap; individual nodes pass smaller numbers.
DEFAULT_MAX_TOKENS = 2048


def make_client(api_key: str) -> AsyncAnthropic:
    """Build an AsyncAnthropic client from a per-request BYOK key."""
    if not api_key or not api_key.strip():
        raise ValueError("Anthropic API key is required (X-Anthropic-Key header).")
    return AsyncAnthropic(api_key=api_key)


async def complete_text(
    *,
    api_key: str,
    model: str,
    system: str,
    user: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> str:
    """Single-shot text completion. Returns the assistant text."""
    client = make_client(api_key)
    response = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(b.text for b in response.content if b.type == "text").strip()


async def complete_json(
    *,
    api_key: str,
    model: str,
    system: str,
    user: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> dict:
    """Like complete_text, but parses the response as JSON.

    Tolerates the model wrapping JSON in a ```json fence. Raises ValueError
    if the response cannot be parsed.
    """
    raw = await complete_text(
        api_key=api_key, model=model, system=system, user=user, max_tokens=max_tokens
    )
    cleaned = _strip_code_fence(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as err:
        logger.error("Failed to parse JSON from model. Raw: %s", raw[:500])
        raise ValueError(f"Model returned non-JSON output: {err}") from err


async def stream_text(
    *,
    api_key: str,
    model: str,
    system: str,
    user: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> AsyncIterator[str]:
    """Async generator yielding text deltas as the model writes them."""
    client = make_client(api_key)
    async with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    ) as stream:
        async for text in stream.text_stream:
            if text:
                yield text


_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?```\s*$", re.DOTALL | re.IGNORECASE)


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    m = _FENCE_RE.match(text)
    if m:
        return m.group(1).strip()
    return text
