# AI-ASSISTED: Cursor
# PROMPT: MongoDB Atlas vector search retrieval with OpenAI query embedding
# ACCEPTED-BY: madavasaran

import logging

from openai import OpenAI
from pymongo.collection import Collection

from app.config import Settings
from app.models import SourceChunk

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
) -> list[SourceChunk]:
    """
    Embed the query and run MongoDB $vectorSearch aggregation.

    Uses index name "vector_index", path "embedding",
    numCandidates=100, limit=5.
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
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    results = list(collection.aggregate(pipeline))

    if not results:
        logger.warning("No matching chunks found for question")
        return []

    chunks = [
        SourceChunk(
            text=doc["text"],
            score=float(doc["score"]),
            chunk_id=doc["chunk_id"],
        )
        for doc in results
    ]

    logger.info("Retrieved %d chunks", len(chunks))
    return chunks
