"""Thin wrappers around the OpenAI Python SDK.

We use the OpenAI client as a *protocol adapter* — almost every modern LLM
provider (OpenAI, Anthropic, DeepSeek, Qwen, Doubao, GLM, OpenRouter,
Ollama, vLLM, etc.) exposes an OpenAI-compatible `/v1/chat/completions`
endpoint, so a single client + the user-supplied `base_url` is enough to
talk to any of them.

The agent graph uses non-streaming `complete_json` for structured outputs
(orchestrator decisions, evaluator scores). The route layer uses
`stream_text` to deliver the interviewer's question and the final report
token-by-token to the SSE client.
"""
from __future__ import annotations

import json
import logging
import re
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Conservative cap; individual nodes pass smaller numbers.
DEFAULT_MAX_TOKENS = 2048


def make_client(api_key: str, base_url: str | None = None) -> AsyncOpenAI:
    """Build an AsyncOpenAI client from a per-request BYOK key.

    `base_url` lets the user point the client at any OpenAI-compatible
    endpoint (DeepSeek, Qwen, Doubao, OpenRouter, a self-hosted proxy, …).
    When omitted the SDK defaults to the official OpenAI API.
    """
    if not api_key or not api_key.strip():
        raise ValueError("API key is required (X-API-Key header).")
    kwargs: dict = {"api_key": api_key.strip()}
    if base_url and base_url.strip():
        kwargs["base_url"] = base_url.strip()
    return AsyncOpenAI(**kwargs)


def _messages(system: str, user: str) -> list[dict]:
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


async def complete_text(
    *,
    api_key: str,
    model: str,
    system: str,
    user: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    base_url: str | None = None,
) -> str:
    """Single-shot text completion. Returns the assistant text."""
    client = make_client(api_key, base_url=base_url)
    response = await client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=_messages(system, user),
    )
    content = response.choices[0].message.content or ""
    return content.strip()


async def complete_json(
    *,
    api_key: str,
    model: str,
    system: str,
    user: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    base_url: str | None = None,
) -> dict:
    """Like complete_text, but parses the response as JSON.

    Tolerates the model wrapping JSON in a ```json fence. Raises ValueError
    if the response cannot be parsed.
    """
    raw = await complete_text(
        api_key=api_key,
        model=model,
        system=system,
        user=user,
        max_tokens=max_tokens,
        base_url=base_url,
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
    base_url: str | None = None,
) -> AsyncIterator[str]:
    """Async generator yielding text deltas as the model writes them."""
    client = make_client(api_key, base_url=base_url)
    stream = await client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=_messages(system, user),
        stream=True,
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        text = getattr(delta, "content", None)
        if text:
            yield text


_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?```\s*$", re.DOTALL | re.IGNORECASE)


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    m = _FENCE_RE.match(text)
    if m:
        return m.group(1).strip()
    return text
