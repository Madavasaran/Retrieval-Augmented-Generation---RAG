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
├── eval/
│   ├── dataset.json     # Labeled evaluation questions
│   ├── metrics.py       # Recall@K, MRR, abstention helpers
│   ├── models.py        # Eval dataset schema
│   └── run_eval.py      # Offline evaluation runner
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
| `RETRIEVAL_MIN_SCORE` | Minimum vector search score to include a chunk (default `0.70`; tune experimentally) |

**`.env` example (Atlas):**

```env
OPENAI_API_KEY=sk-...
MONGODB_URI=
DB_NAME=rag_db
COLLECTION_NAME=documents
RETRIEVAL_MIN_SCORE=0.70
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
  "page": 14,
  "chunk_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_hash": "a1b2c3..."
}
```

Duplicate PDFs (same SHA-256 content) are skipped automatically — no new embeddings are created.

> **Tip:** Create a MongoDB index on `file_hash` for faster duplicate checks at scale: `{ "file_hash": 1 }`

> **Note:** Re-ingest PDFs after upgrading to populate `page` / `file_hash` metadata on older documents.

### 6. Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## API Endpoints

### `POST /ingest`

Upload a PDF file for ingestion. Validates the `.pdf` extension, `%PDF` magic bytes, and PDF structure before processing.

**Request:** `multipart/form-data` with a `file` field containing a PDF.

**Response (new document):**

```json
{
  "chunks_stored": 42,
  "source": "my-document.pdf",
  "skipped": false,
  "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

**Response (duplicate — same PDF content already ingested):**

```json
{
  "chunks_stored": 0,
  "source": "my-document.pdf",
  "skipped": true,
  "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852"
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
  "answer": "The refund period is 30 days.",
  "sources": [
    {
      "source": "policy.pdf",
      "page": 12,
      "chunk_id": "550e8400-e29b-41d4-a716-446655440000",
      "score": 0.8721
    }
  ]
}
```

Only sources that pass `RETRIEVAL_MIN_SCORE` are returned. Irrelevant queries return `"I don't know"` with an empty `sources` list.

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
| Non-PDF upload / invalid PDF | 400 | Extension, magic-byte, or structure validation error |
| Duplicate PDF (same SHA-256) | 200 | `skipped: true`, `chunks_stored: 0` |
| Empty PDF / no extractable text | 400 | Descriptive error message |
| No matching chunks found | 200 | Answer: `"I don't know"`, empty sources |
| All chunks below `RETRIEVAL_MIN_SCORE` | 200 | Answer: `"I don't know"`, empty sources (LLM not called) |
| OpenAI / MongoDB failures | 500 | Generic error with server-side logging |

## How It Works

1. **Ingest:** Upload is validated (`.pdf` extension, `%PDF` header, readable PDF). A SHA-256 hash is computed; if that hash already exists in MongoDB, ingestion is skipped. Otherwise, PDF text is extracted page-by-page with `pypdf`, split into 500-token chunks per page (50-token overlap within each page), embedded with `text-embedding-3-large`, and inserted into MongoDB with `source`, `page`, and `file_hash` metadata.
2. **Retrieve:** The user question is embedded with the same model. MongoDB `$vectorSearch` finds the top 5 most similar chunks (`numCandidates=100`, cosine similarity). Results below `RETRIEVAL_MIN_SCORE` are discarded.
3. **Generate:** Passing chunks are passed as context to `gpt-4o-mini` with a system prompt that restricts answers to the provided context only. The API returns citation metadata (`source`, `page`, `chunk_id`, `score`) without chunk text.

## Evaluation (custom, no RAGAS)

Offline evaluation measures retrieval quality and end-to-end behavior against a labeled dataset.

### Dataset

Edit [`eval/dataset.json`](eval/dataset.json). Each case supports:

| Field | Purpose |
|-------|---------|
| `question` | User question |
| `should_answer` | `false` for irrelevant/unanswerable queries |
| `expected_source` | Expected PDF filename in citations |
| `expected_page` | Expected page number (1-based) |
| `expected_chunk_ids` | Gold chunk IDs for Recall@K / MRR (optional) |
| `expected_answer_contains` | Substrings that should appear in the answer |
| `category` | `relevant`, `irrelevant`, or `unanswerable` |

After ingesting a PDF, copy real `chunk_id` values from MongoDB Compass into `expected_chunk_ids` for strict retrieval metrics.

### Run evaluation

```bash
# Full eval (retrieval + generation) — uses OpenAI API
python eval/run_eval.py

# Retrieval metrics only (no LLM generation cost)
python eval/run_eval.py --skip-generation
```

Results are saved to `eval/results/eval_<timestamp>.json` and printed as a summary table.

### Metrics

| Metric | What it measures |
|--------|------------------|
| **Recall@K** | Gold chunks found in top-K raw retrieval |
| **Precision@K** | Relevant chunks in top-K raw retrieval |
| **MRR** | Rank of first gold chunk |
| **source_match_rate** | Expected PDF appears in raw retrieval |
| **page_match_rate** | Expected page appears in raw retrieval |
| **abstention_accuracy** | `"I don't know"` when `should_answer: false` |
| **keyword_coverage** | Expected answer phrases found in output |

Raw retrieval (pre-threshold) is used for Recall/Precision/MRR. Generation uses the same post-threshold filtering as `/query`.
