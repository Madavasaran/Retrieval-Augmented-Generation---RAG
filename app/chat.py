# AI-ASSISTED: Cursor
# PROMPT: Add direct OpenAI chat completion endpoint without RAG retrieval
# ACCEPTED-BY: madavasaran

import logging

from openai import OpenAI

from app.config import Settings

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant."


def chat_completion(
    question: str,
    temperature: float,
    max_tokens: int,
    model: str,
    settings: Settings,
    openai_client: OpenAI,
    system_prompt: str | None = None,
) -> str:
    """Generate an answer via OpenAI chat completion (no retrieval)."""
    system_content = (system_prompt or "").strip() or DEFAULT_SYSTEM_PROMPT

    logger.info(
        "Chat completion: model=%s temperature=%.1f max_tokens=%d",
        model,
        temperature,
        max_tokens,
    )

    response = openai_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_content},
            {"role": "user", "content": question},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )

    answer = response.choices[0].message.content or ""
    logger.info("Chat answer generated (%d chars)", len(answer))
    return answer.strip()
