import hashlib
import logging
import re
import uuid
from dataclasses import dataclass
from io import BytesIO

import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import OpenAI
from pymongo.collection import Collection
from pypdf import PdfReader

from app.config import Settings

logger = logging.getLogger(__name__)

# Chunks are generated per page. Overlap applies only within the same page.
# A chunk never spans two pages; cross-page context is not preserved at boundaries.


@dataclass
class IngestResult:
    """Result of a PDF ingestion attempt."""

    chunks_stored: int
    skipped: bool = False
    file_hash: str = ""


def _compute_file_hash(file_bytes: bytes) -> str:
    """Return the SHA-256 hex digest of the PDF bytes."""
    return hashlib.sha256(file_bytes).hexdigest()


def _normalize_whitespace(text: str) -> str:
    """Collapse irregular PDF spacing into clean single-spaced text."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[^\S\n]+", " ", text)
    text = re.sub(r" *\n+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = [re.sub(r" +", " ", line).strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line)


def _load_pdf_pages(file_bytes: bytes) -> list[tuple[int, str]]:
    """Extract text from each PDF page with 1-based page numbers."""
    reader = PdfReader(BytesIO(file_bytes))
    pages: list[tuple[int, str]] = []
    for page_num, page in enumerate(reader.pages, start=1):
        text = _normalize_whitespace(page.extract_text() or "")
        if text:
            pages.append((page_num, text))
    if not pages:
        raise ValueError("PDF contains no extractable text")
    return pages


def _chunk_pages(pages: list[tuple[int, str]]) -> list[tuple[str, int]]:
    """Split each page into token-based chunks tagged with page number."""
    encoding = tiktoken.encoding_for_model("gpt-4o-mini")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        length_function=lambda t: len(encoding.encode(t)),
    )
    chunks: list[tuple[str, int]] = []
    for page_num, text in pages:
        for chunk in splitter.split_text(text):
            chunks.append((chunk, page_num))
    return chunks


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
) -> IngestResult:
    """
    Load a PDF, chunk it page-by-page, embed each chunk, and insert into MongoDB.

    Skips ingestion when the SHA-256 hash of the PDF already exists in the collection.

    Each document stored has the shape:
    {text, embedding, source, page, chunk_id, file_hash}
    """
    file_hash = _compute_file_hash(file_bytes)

    if collection.find_one({"file_hash": file_hash}, {"_id": 1}):
        logger.info(
            "Skipping duplicate PDF %s (file_hash=%s already ingested)",
            filename,
            file_hash,
        )
        return IngestResult(chunks_stored=0, skipped=True, file_hash=file_hash)

    logger.info("Starting ingestion for file: %s (file_hash=%s)", filename, file_hash)

    pages = _load_pdf_pages(file_bytes)
    chunk_pages = _chunk_pages(pages)

    if not chunk_pages:
        raise ValueError("PDF produced no text chunks after splitting")

    logger.info(
        "Extracted %d chunks from %d pages in %s",
        len(chunk_pages),
        len(pages),
        filename,
    )

    texts = [chunk for chunk, _ in chunk_pages]
    embeddings = _embed_texts(openai_client, texts, settings.embedding_model)

    documents = [
        {
            "text": chunk,
            "embedding": embedding,
            "source": filename,
            "page": page_num,
            "chunk_id": str(uuid.uuid4()),
            "file_hash": file_hash,
        }
        for (chunk, page_num), embedding in zip(chunk_pages, embeddings)
    ]

    result = collection.insert_many(documents)
    stored = len(result.inserted_ids)
    logger.info("Stored %d chunks for %s", stored, filename)
    return IngestResult(chunks_stored=stored, skipped=False, file_hash=file_hash)
