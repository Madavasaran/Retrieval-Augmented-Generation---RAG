from pydantic import BaseModel, Field


class IngestResponse(BaseModel):
    """Response returned after PDF ingestion."""

    chunks_stored: int = Field(..., description="Number of text chunks stored in MongoDB")
    source: str = Field(..., description="Filename of the ingested PDF")


class SourceChunk(BaseModel):
    """A retrieved chunk with its similarity score."""

    text: str
    score: float
    chunk_id: str


class QueryRequest(BaseModel):
    """Request body for the /query endpoint."""

    question: str = Field(..., min_length=1, description="User question to answer")


class QueryResponse(BaseModel):
    """Response containing the generated answer and source chunks."""

    answer: str
    sources: list[SourceChunk]
