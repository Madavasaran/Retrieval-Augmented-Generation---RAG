import logging
import time

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from openai import OpenAI
from pydantic import ValidationError
from pymongo import MongoClient
from pymongo.collection import Collection

from app.config import Settings, get_settings
from app.generate import generate_answer
from app.ingest import ingest_pdf
from app.models import IngestResponse, QueryRequest, QueryResponse
from app.retrieve import retrieve_chunks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RAG API",
    description="Retrieval-Augmented Generation API with MongoDB Atlas Vector Search",
    version="1.0.0",
)


def _get_openai_client(settings: Settings = Depends(get_settings)) -> OpenAI:
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")
    return OpenAI(api_key=settings.openai_api_key)


def _get_collection(settings: Settings = Depends(get_settings)) -> Collection:
    if not settings.mongodb_uri:
        raise HTTPException(status_code=500, detail="MONGODB_URI is not configured")
    client = MongoClient(settings.mongodb_uri)
    db = client[settings.db_name]
    return db[settings.collection_name]


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log incoming requests and response times."""
    start = time.perf_counter()
    logger.info("Request: %s %s", request.method, request.url.path)
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "Response: %s %s -> %d (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/ingest", response_model=IngestResponse)
async def ingest_endpoint(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    openai_client: OpenAI = Depends(_get_openai_client),
    collection: Collection = Depends(_get_collection),
):
    """Ingest a PDF: chunk, embed, and store in MongoDB."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        chunks_stored = ingest_pdf(
            file_bytes=file_bytes,
            filename=file.filename,
            collection=collection,
            settings=settings,
            openai_client=openai_client,
        )
    except ValueError as exc:
        logger.warning("Ingestion failed for %s: %s", file.filename, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error during ingestion of %s", file.filename)
        raise HTTPException(status_code=500, detail="Ingestion failed") from exc

    return IngestResponse(chunks_stored=chunks_stored, source=file.filename)


@app.post("/query", response_model=QueryResponse)
def query_endpoint(
    body: QueryRequest,
    settings: Settings = Depends(get_settings),
    openai_client: OpenAI = Depends(_get_openai_client),
    collection: Collection = Depends(_get_collection),
):
    """Answer a question using retrieval-augmented generation."""
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty")

    try:
        sources = retrieve_chunks(
            question=question,
            collection=collection,
            settings=settings,
            openai_client=openai_client,
        )
    except Exception as exc:
        logger.exception("Retrieval failed for question: %s", question[:100])
        raise HTTPException(status_code=500, detail="Retrieval failed") from exc

    if not sources:
        return QueryResponse(
            answer="I don't know",
            sources=[],
        )

    try:
        answer = generate_answer(
            question=question,
            sources=sources,
            settings=settings,
            openai_client=openai_client,
        )
    except Exception as exc:
        logger.exception("Generation failed for question: %s", question[:100])
        raise HTTPException(status_code=500, detail="Answer generation failed") from exc

    return QueryResponse(answer=answer, sources=sources)


@app.exception_handler(ValidationError)
async def validation_exception_handler(_request: Request, exc: ValidationError):
    """Return a clear error when settings fail to load from environment."""
    logger.error("Configuration validation error: %s", exc)
    raise HTTPException(
        status_code=500,
        detail="Server configuration error. Check environment variables.",
    ) from exc
