from pydantic import BaseModel, Field


class IngestResponse(BaseModel):
    """Response returned after PDF ingestion."""

    chunks_stored: int = Field(..., description="Number of text chunks stored in MongoDB")
    source: str = Field(..., description="Filename of the ingested PDF")
    skipped: bool = Field(
        default=False,
        description="True when the PDF was already ingested (duplicate file hash)",
    )
    file_hash: str = Field(..., description="SHA-256 hash of the uploaded PDF")


class RetrievedChunk(BaseModel):
    """Internal retrieval result used for LLM context generation."""

    text: str
    score: float
    chunk_id: str
    source: str
    page: int | None = None


class SourceCitation(BaseModel):
    """Public citation returned by /query (no chunk text)."""

    source: str
    page: int | None = None
    chunk_id: str
    score: float


class QueryRequest(BaseModel):
    """Request body for the /query endpoint."""

    question: str = Field(..., min_length=1, description="User question to answer")


class QueryResponse(BaseModel):
    """Response containing the generated answer and source citations."""

    answer: str
    sources: list[SourceCitation]
