import logging
from functools import lru_cache

import certifi
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

_ATLAS_SSL_HINT = (
    "Could not connect to MongoDB Atlas. Common fixes: "
    "(1) Atlas → Network Access → add your current public IP (or 0.0.0.0/0 for dev), "
    "(2) verify MONGODB_URI username/password, "
    "(3) wait 1–2 minutes after changing Network Access."
)


def _normalize_uri(uri: str) -> str:
    """Ensure Atlas URI includes standard query parameters."""
    uri = uri.strip().rstrip("/")
    if "?" in uri:
        return uri
    return f"{uri}/?retryWrites=true&w=majority"


@lru_cache
def get_mongo_client(mongodb_uri: str) -> MongoClient:
    """Return a cached MongoClient configured for Atlas TLS."""
    return MongoClient(
        _normalize_uri(mongodb_uri),
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=15000,
    )


def get_collection(settings: Settings | None = None) -> Collection:
    """Return the configured MongoDB collection."""
    settings = settings or get_settings()
    client = get_mongo_client(settings.mongodb_uri)
    return client[settings.db_name][settings.collection_name]


def verify_mongo_connection(settings: Settings | None = None) -> None:
    """Ping MongoDB and raise a clear error if the connection fails."""
    settings = settings or get_settings()
    try:
        get_mongo_client(settings.mongodb_uri).admin.command("ping")
    except PyMongoError as exc:
        logger.error("MongoDB connection failed: %s", exc)
        raise ConnectionError(_ATLAS_SSL_HINT) from exc
