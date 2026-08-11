

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


def retrieve_chunks(
    question: str,
    collection: Collection,
    settings: Settings,
    openai_client: OpenAI,
) -> list[RetrievedChunk]:
    """
    Embed the query and run MongoDB $vectorSearch aggregation.

    Uses index name "vector_index", path "embedding",
    numCandidates=100, limit=5. Filters by settings.retrieval_min_score.
    """
    logger.info("Retrieving chunks for question: %s", question[:100])

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

    results = list(collection.aggregate(pipeline))

    if not results:
        logger.warning("No matching chunks found for question")
        return []

    min_score = settings.retrieval_min_score
    chunks: list[RetrievedChunk] = []
    for doc in results:
        score = float(doc["score"])
        if score < min_score:
            continue
        chunks.append(
            RetrievedChunk(
                text=doc["text"],
                score=score,
                chunk_id=doc["chunk_id"],
                source=doc.get("source", ""),
                page=doc.get("page"),
            )
        )

    logger.info(
        "Retrieved %d raw results, %d passed min score %.2f",
        len(results),
        len(chunks),
        min_score,
    )

    if results and not chunks:
        logger.warning(
            "All %d retrieved chunks were below min score %.2f",
            len(results),
            min_score,
        )

    return chunks
