# RAG FastAPI Application

A Retrieval-Augmented Generation (RAG) API built with FastAPI, OpenAI embeddings, and MongoDB Atlas Vector Search.

## Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI (Python 3.11+) |
| Embeddings | OpenAI `text-embedding-3-large` (3072 dimensions) |
| Vector store | MongoDB Atlas Vector Search |
| Generation | OpenAI `gpt-4o-mini` |
| PDF parsing | pypdf |
| Chunking | LangChain `RecursiveCharacterTextSplitter` (500 tokens, 50 overlap) |

## Project Structure

```
rag-project/
├── app/
│   ├── main.py          # FastAPI app with /ingest and /query endpoints
│   ├── config.py        # Environment settings via pydantic-settings
│   ├── ingest.py        # PDF → chunks → embeddings → MongoDB
│   ├── retrieve.py      # Query embedding + $vectorSearch
│   ├── generate.py      # Context-aware answer generation
│   └── models.py        # Pydantic request/response models
├── requirements.txt
├── .env.example
└── README.md
```

## Setup

### 1. Clone and install dependencies

```bash
cd rag-project
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Create a MongoDB Atlas cluster

1. Sign up / log in at [MongoDB Atlas](https://cloud.mongodb.com).
2. Create a **free M0 cluster** (any cloud provider/region is fine).
3. Under **Database Access**, create a database user with **read and write** permissions. Save the username and password.
4. Under **Network Access**, add your IP address (or `0.0.0.0/0` for development only).
5. On the cluster page, click **Connect** → **Drivers** → copy the **connection string**.
   - Replace `<password>` with your database user password.
   - Replace `<dbname>` if present, or leave query params as-is.

Example Atlas URI:

```text
mongodb+srv:
```

### 3. Connect with MongoDB Compass (optional but recommended)

1. Open **MongoDB Compass**.
2. Paste your Atlas connection string and click **Connect**.
3. You should see your cluster. The `rag_db` database and `documents` collection are created automatically on first ingest.

### 4. Configure environment variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `MONGODB_URI` | Atlas connection string (`mongodb+srv://...`) |
| `DB_NAME` | Database name (e.g. `rag_db`) |
| `COLLECTION_NAME` | Collection name (e.g. `documents`) |

**`.env` example (Atlas):**

```env
OPENAI_API_KEY=sk-...
MONGODB_URI=
DB_NAME=rag_db
COLLECTION_NAME=documents
```

> **Tip:** If your password contains special characters (`@`, `#`, `/`, etc.), URL-encode them in the connection string (e.g. `@` → `%40`).

### 5. Create the MongoDB Atlas Vector Search index

In the [MongoDB Atlas UI](https://cloud.mongodb.com) or **Compass connected to Atlas**:

1. Go to your cluster → **Browse Collections**.
2. Select database **`rag_db`** and collection **`documents`**.
   - If they don't exist yet, run `/ingest` once first, then refresh.
3. Open the **Search Indexes** tab → **Create Search Index**.
4. Choose **JSON Editor**.
5. Set the index name to **`vector_index`** (must match `app/config.py`).
6. Paste this definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 3072,
      "similarity": "cosine"
    }
  ]
}
```

Alternatively, using the explicit `vectorSearch` format:

```json
{
  "name": "vector_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 3072,
        "similarity": "cosine"
      }
    ]
  }
}
```

> **Note:** Index creation can take a few minutes. Wait until status is **Active** before running `/query`.

Each ingested document is stored with this shape:

```json
{
  "text": "chunk text content...",
  "embedding": [0.012, -0.034, ...],
  "source": "document.pdf",
  "chunk_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 6. Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## API Endpoints

### `POST /ingest`

Upload a PDF file for ingestion.

**Request:** `multipart/form-data` with a `file` field containing a PDF.

**Response:**

```json
{
  "chunks_stored": 42,
  "source": "my-document.pdf"
}
```

**Example:**

```bash
curl -X POST http://localhost:8000/ingest \
  -F "file=@/path/to/document.pdf"
```

### `POST /query`

Ask a question against ingested documents.

**Request:**

```json
{
  "question": "What is the main topic of the document?"
}
```

**Response:**

```json
{
  "answer": "The main topic is ...",
  "sources": [
    {
      "text": "relevant chunk text...",
      "score": 0.8721,
      "chunk_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  ]
}
```

**Example:**

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the main topic?"}'
```

### `GET /health`

Returns `{"status": "ok"}`.

## Troubleshooting

### `SSL handshake failed` / `TLSV1_ALERT_INTERNAL_ERROR`

This almost always means **Atlas is blocking your IP**, not a bug in the app.

1. Go to [Atlas → Network Access](https://cloud.mongodb.com/v2#/security/network/whitelist).
2. Click **Add IP Address** → **Add Current IP Address** (or `0.0.0.0/0` for development).
3. Wait **1–2 minutes**, then retry.

Verify from your terminal (should print `{ ok: 1 }`):

```bash
mongosh "YOUR_MONGODB_URI" --eval 'db.runCommand({ ping: 1 })'
```

If `mongosh` fails with the same SSL error, fix Atlas Network Access before retrying `/ingest`.

## Error Handling

| Scenario | HTTP Status | Behavior |
|----------|-------------|----------|
| Missing or invalid env vars | 500 | Configuration error message |
| Non-PDF upload | 400 | "Only PDF files are supported" |
| Empty PDF / no extractable text | 400 | Descriptive error message |
| No matching chunks found | 200 | Answer: `"I don't know"`, empty sources |
| OpenAI / MongoDB failures | 500 | Generic error with server-side logging |

## How It Works

1. **Ingest:** PDF text is extracted with `pypdf`, split into 500-token chunks (50-token overlap) using LangChain's `RecursiveCharacterTextSplitter`, embedded with `text-embedding-3-large`, and inserted into MongoDB.
2. **Retrieve:** The user question is embedded with the same model. MongoDB `$vectorSearch` finds the top 5 most similar chunks (`numCandidates=100`, cosine similarity).
3. **Generate:** Retrieved chunks are passed as context to `gpt-4o-mini` with a system prompt that restricts answers to the provided context only.
