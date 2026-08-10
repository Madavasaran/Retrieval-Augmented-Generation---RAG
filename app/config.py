from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")
    mongodb_uri: str = Field(..., alias="MONGODB_URI")
    db_name: str = Field(..., alias="DB_NAME")
    collection_name: str = Field(..., alias="COLLECTION_NAME")

    embedding_model: str = "text-embedding-3-large"
    embedding_dimensions: int = 3072
    chat_model: str = "gpt-4o-mini"
    vector_index_name: str = "vector_index"

    @field_validator("openai_api_key", "mongodb_uri", "db_name", "collection_name")
    @classmethod
    def must_not_be_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Environment variable must not be empty")
        return value.strip()


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
