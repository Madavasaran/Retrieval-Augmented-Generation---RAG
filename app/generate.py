import logging

from openai import OpenAI

from app.config import Settings
from app.models import SourceChunk

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a helpful assistant that answers questions based ONLY on the "
    "provided context. If the answer cannot be found in the context, respond "
    "with exactly: I don't know. Do not use any outside knowledge."
)


def _build_context(sources: list[SourceChunk]) -> str:
    """Format retrieved chunks into a context block for the prompt."""
    parts = []
    for i, source in enumerate(sources, start=1):
        parts.append(f"[Chunk {i} | score={source.score:.4f}]\n{source.text}")
    return "\n\n".join(parts)


def generate_answer(
    question: str,
    sources: list[SourceChunk],
    settings: Settings,
    openai_client: OpenAI,
) -> str:
    """Generate an answer using retrieved chunks as context."""
    context = _build_context(sources)

    user_message = (
        f"Context:\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer the question using only the context above."
    )

    logger.info("Generating answer with model: %s", settings.chat_model)

    response = openai_client.chat.completions.create(
        model=settings.chat_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0,
    )

    answer = response.choices[0].message.content or "I don't know"
    logger.info("Generated answer (%d chars)", len(answer))
    return answer.strip()
