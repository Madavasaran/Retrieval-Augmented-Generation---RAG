from pydantic import BaseModel, Field


class EvalCase(BaseModel):
    """One labeled question in the evaluation dataset."""

    id: str
    question: str
    category: str = Field(
        default="relevant",
        description="relevant | irrelevant | unanswerable",
    )
    should_answer: bool = True
    expected_source: str | None = None
    expected_page: int | None = None
    expected_chunk_ids: list[str] = Field(default_factory=list)
    expected_answer_contains: list[str] = Field(default_factory=list)


class EvalDataset(BaseModel):
    """Collection of evaluation cases."""

    cases: list[EvalCase]
