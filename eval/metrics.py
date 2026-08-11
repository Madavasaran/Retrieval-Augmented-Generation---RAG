"""Metric helpers for the custom RAG evaluation runner."""

from __future__ import annotations

IDK_ANSWER = "i don't know"


def recall_at_k(retrieved_ids: list[str], expected_ids: set[str], k: int) -> float | None:
    """Fraction of expected chunks found in the top-k retrieved IDs."""
    if not expected_ids:
        return None
    hits = len(set(retrieved_ids[:k]) & expected_ids)
    return hits / len(expected_ids)


def precision_at_k(retrieved_ids: list[str], expected_ids: set[str], k: int) -> float | None:
    """Fraction of top-k retrieved IDs that are expected relevant chunks."""
    if not expected_ids or k <= 0:
        return None
    hits = len(set(retrieved_ids[:k]) & expected_ids)
    return hits / k


def reciprocal_rank(retrieved_ids: list[str], expected_ids: set[str]) -> float | None:
    """Reciprocal rank of the first expected chunk in the retrieved list."""
    if not expected_ids:
        return None
    for rank, chunk_id in enumerate(retrieved_ids, start=1):
        if chunk_id in expected_ids:
            return 1.0 / rank
    return 0.0


def source_match(retrieved_sources: list[str], expected_source: str | None) -> bool | None:
    """True when the expected source filename appears in retrieved results."""
    if expected_source is None:
        return None
    return expected_source in retrieved_sources


def page_match(retrieved_pages: list[int | None], expected_page: int | None) -> bool | None:
    """True when the expected page appears in retrieved results."""
    if expected_page is None:
        return None
    return expected_page in retrieved_pages


def is_abstention(answer: str) -> bool:
    """True when the model returned the configured abstention phrase."""
    normalized = answer.strip().lower().rstrip(".")
    return normalized == IDK_ANSWER


def keyword_coverage(answer: str, expected_keywords: list[str]) -> float | None:
    """Fraction of expected substrings present in the answer (case-insensitive)."""
    if not expected_keywords:
        return None
    answer_lower = answer.lower()
    hits = sum(1 for keyword in expected_keywords if keyword.lower() in answer_lower)
    return hits / len(expected_keywords)


def average(values: list[float]) -> float | None:
    """Return the arithmetic mean or None when the input list is empty."""
    if not values:
        return None
    return sum(values) / len(values)
