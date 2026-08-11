"""
Run retrieval and generation evaluation against eval/dataset.json.

Usage:
    python eval/run_eval.py
    python eval/run_eval.py --dataset eval/dataset.json --skip-generation
    python eval/run_eval.py --k 5
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.config import get_settings
from app.db import get_collection
from app.generate import generate_answer
from app.retrieve import vector_search_chunks
from eval.metrics import (
    average,
    is_abstention,
    keyword_coverage,
    page_match,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
    source_match,
)
from eval.models import EvalCase, EvalDataset


def _load_dataset(path: Path) -> EvalDataset:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return EvalDataset(cases=[EvalCase(**item) for item in data])
    return EvalDataset(**data)


def _filter_by_threshold(
    chunks: list,
    min_score: float,
) -> list:
    return [chunk for chunk in chunks if chunk.score >= min_score]


def _evaluate_case(
    case: EvalCase,
    *,
    k: int,
    skip_generation: bool,
    settings,
    collection,
    openai_client: OpenAI,
) -> dict:
    raw_chunks = vector_search_chunks(
        question=case.question,
        collection=collection,
        settings=settings,
        openai_client=openai_client,
    )
    filtered_chunks = _filter_by_threshold(raw_chunks, settings.retrieval_min_score)

    raw_ids = [chunk.chunk_id for chunk in raw_chunks]
    raw_sources = [chunk.source for chunk in raw_chunks]
    raw_pages = [chunk.page for chunk in raw_chunks]
    expected_ids = set(case.expected_chunk_ids)

    answer = "I don't know, I am a RAG assistant. I am only able to answer questions based on the provided context"
    llm_called = False
    if filtered_chunks and not skip_generation:
        llm_called = True
        answer = generate_answer(
            question=case.question,
            sources=filtered_chunks,
            settings=settings,
            openai_client=openai_client,
        )
    elif not filtered_chunks:
        llm_called = False

    abstained = is_abstention(answer)
    abstention_correct = abstained == (not case.should_answer)

    return {
        "id": case.id,
        "question": case.question,
        "category": case.category,
        "should_answer": case.should_answer,
        "raw_retrieved_count": len(raw_chunks),
        "filtered_retrieved_count": len(filtered_chunks),
        "recall_at_k": recall_at_k(raw_ids, expected_ids, k),
        "precision_at_k": precision_at_k(raw_ids, expected_ids, k),
        "mrr": reciprocal_rank(raw_ids, expected_ids),
        "source_match": source_match(raw_sources, case.expected_source),
        "page_match": page_match(raw_pages, case.expected_page),
        "abstention_correct": abstention_correct,
        "keyword_coverage": keyword_coverage(answer, case.expected_answer_contains),
        "llm_called": llm_called,
        "answer": answer,
        "top_raw_score": raw_chunks[0].score if raw_chunks else None,
        "top_filtered_score": filtered_chunks[0].score if filtered_chunks else None,
    }


def _aggregate(results: list[dict]) -> dict:
    def collect(key: str) -> list[float]:
        values: list[float] = []
        for row in results:
            value = row.get(key)
            if isinstance(value, bool):
                values.append(1.0 if value else 0.0)
            elif isinstance(value, (int, float)):
                values.append(float(value))
        return values

    def collect_optional(key: str) -> list[float]:
        values: list[float] = []
        for row in results:
            value = row.get(key)
            if value is None:
                continue
            if isinstance(value, bool):
                values.append(1.0 if value else 0.0)
            elif isinstance(value, (int, float)):
                values.append(float(value))
        return values

    return {
        "cases": len(results),
        "recall_at_k": average(collect_optional("recall_at_k")),
        "precision_at_k": average(collect_optional("precision_at_k")),
        "mrr": average(collect_optional("mrr")),
        "source_match_rate": average(collect_optional("source_match")),
        "page_match_rate": average(collect_optional("page_match")),
        "abstention_accuracy": average(collect("abstention_correct")),
        "keyword_coverage": average(collect_optional("keyword_coverage")),
        "llm_call_rate": average(collect("llm_called")),
    }


def _print_summary(summary: dict, results: list[dict]) -> None:
    print("\n=== RAG Evaluation Summary ===")
    for key, value in summary.items():
        if key == "cases":
            print(f"{key}: {value}")
        elif value is None:
            print(f"{key}: n/a")
        else:
            print(f"{key}: {value:.3f}")

    print("\n=== Per-case ===")
    for row in results:
        print(
            f"[{row['id']}] abstention_ok={row['abstention_correct']} "
            f"filtered={row['filtered_retrieved_count']} "
            f"llm_called={row['llm_called']} "
            f"kw={row['keyword_coverage']}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run custom RAG evaluation")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=PROJECT_ROOT / "eval" / "dataset.json",
        help="Path to evaluation dataset JSON",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=PROJECT_ROOT / "eval" / "results",
        help="Directory for JSON result files",
    )
    parser.add_argument("--k", type=int, default=5, help="Top-k for retrieval metrics")
    parser.add_argument(
        "--skip-generation",
        action="store_true",
        help="Skip OpenAI answer generation (retrieval metrics only)",
    )
    args = parser.parse_args()

    settings = get_settings()
    collection = get_collection(settings)
    openai_client = OpenAI(api_key=settings.openai_api_key)
    dataset = _load_dataset(args.dataset)

    results = [
        _evaluate_case(
            case,
            k=args.k,
            skip_generation=args.skip_generation,
            settings=settings,
            collection=collection,
            openai_client=openai_client,
        )
        for case in dataset.cases
    ]
    summary = _aggregate(results)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_path = args.output_dir / f"eval_{timestamp}.json"
    payload = {
        "timestamp": timestamp,
        "dataset": str(args.dataset),
        "k": args.k,
        "skip_generation": args.skip_generation,
        "retrieval_min_score": settings.retrieval_min_score,
        "summary": summary,
        "results": results,
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    _print_summary(summary, results)
    print(f"\nSaved report to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
