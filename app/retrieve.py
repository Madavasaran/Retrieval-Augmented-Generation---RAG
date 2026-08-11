import logging

from openai import OpenAI
from pymongo.collection import Collection

from app.config import Settings
from app.models import RetrievedChunk

logger = logging.getLogger(__name__)


def _embed_query(client: OpenAI, query: str, model: str) -> list[float]:
    """Embed a single query string."""
    response = client.embeddings.create(input=query, model=model)
    return response.data[0].embedding


def _doc_to_chunk(doc: dict) -> RetrievedChunk:
    return RetrievedChunk(
        text=doc["text"],
        score=float(doc["score"]),
        chunk_id=doc["chunk_id"],
        source=doc.get("source", ""),
        page=doc.get("page"),
    )


def vector_search_chunks(
    question: str,
    collection: Collection,
    settings: Settings,
    openai_client: OpenAI,
) -> list[RetrievedChunk]:
    """
    Run MongoDB $vectorSearch and return top-k results without score filtering.

    Uses index name "vector_index", path "embedding",
    numCandidates=100, limit=5.
    """
    query_vector = _embed_query(openai_client, question, settings.embedding_model)

    pipeline = [
        {
            "$vectorSearch": {
                "index": settings.vector_index_name,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": 100,
                "limit": 5,
            }
        },
        {
            "$project": {
                "_id": 0,
                "text": 1,
                "chunk_id": 1,
                "source": 1,
                "page": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    return [_doc_to_chunk(doc) for doc in collection.aggregate(pipeline)]


def retrieve_chunks(
    question: str,
    collection: Collection,
    settings: Settings,
    openai_client: OpenAI,
) -> list[RetrievedChunk]:
    """
    Embed the query, run vector search, and filter by retrieval_min_score.
    """
    logger.info("Retrieving chunks for question: %s", question[:100])

    raw_results = vector_search_chunks(
        question=question,
        collection=collection,
        settings=settings,
        openai_client=openai_client,
    )

    if not raw_results:
        logger.warning("No matching chunks found for question")
        return []

    min_score = settings.retrieval_min_score
    chunks = [chunk for chunk in raw_results if chunk.score >= min_score]

    logger.info(
        "Retrieved %d raw results, %d passed min score %.2f",
        len(raw_results),
        len(chunks),
        min_score,
    )

    if raw_results and not chunks:
        logger.warning(
            "All %d retrieved chunks were below min score %.2f",
            len(raw_results),
            min_score,
        )

    return chunks
