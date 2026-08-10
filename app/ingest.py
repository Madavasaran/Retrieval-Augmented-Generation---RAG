import logging
import re
import uuid
from io import BytesIO

import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import OpenAI
from pymongo.collection import Collection
from pypdf import PdfReader

from app.config import Settings

logger = logging.getLogger(__name__)


def _normalize_whitespace(text: str) -> str:
    """Collapse irregular PDF spacing into clean single-spaced text."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[^\S\n]+", " ", text)
    text = re.sub(r" *\n+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = [re.sub(r" +", " ", line).strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line)


def _load_pdf_text(file_bytes: bytes) -> str:
    """Extract all text from a PDF byte stream."""
    reader = PdfReader(BytesIO(file_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    text = _normalize_whitespace("\n".join(pages))
    if not text:
        raise ValueError("PDF contains no extractable text")
    return text


def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping token-based chunks."""
    encoding = tiktoken.encoding_for_model("gpt-4o-mini")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        length_function=lambda t: len(encoding.encode(t)),
    )
    return splitter.split_text(text)


def _embed_texts(client: OpenAI, texts: list[str], model: str) -> list[list[float]]:
    """Embed a batch of text strings using OpenAI."""
    response = client.embeddings.create(input=texts, model=model)
    return [item.embedding for item in response.data]


def ingest_pdf(
    file_bytes: bytes,
    filename: str,
    collection: Collection,
    settings: Settings,
    openai_client: OpenAI,
) -> int:
    """
    Load a PDF, chunk it, embed each chunk, and insert into MongoDB.

    Each document stored has the shape:
    {text, embedding, source, chunk_id}
    """
    logger.info("Starting ingestion for file: %s", filename)

    text = _load_pdf_text(file_bytes)
    chunks = _chunk_text(text)

    if not chunks:
        raise ValueError("PDF produced no text chunks after splitting")

    logger.info("Extracted %d chunks from %s", len(chunks), filename)

    embeddings = _embed_texts(openai_client, chunks, settings.embedding_model)

    documents = [
        {
            "text": chunk,
            "embedding": embedding,
            "source": filename,
            "chunk_id": str(uuid.uuid4()),
        }
        for chunk, embedding in zip(chunks, embeddings)
    ]

    result = collection.insert_many(documents)
    stored = len(result.inserted_ids)
    logger.info("Stored %d chunks for %s", stored, filename)
    return stored
