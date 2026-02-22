# 🎓 IRRA — Intelligent RAG Revision Assistant

An AI-powered study companion for university students, built with **Retrieval-Augmented Generation (RAG)** and **Google Gemini**.

**Group 12 | AAI3008 Large Language Models**

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📓 **Multi-Notebook** | Organise study materials into separate isolated notebooks |
| 📚 **Study Chat** | Ask questions grounded in your lecture materials with source citations |
| 💬 **Chat History** | Browse, resume, and delete past study conversations |
| 📝 **Exam Mode** | Practice with AI-generated MCQ, True/False, and Short Answer questions |
| 📤 **Upload Notes** | Upload PDF, Word, PowerPoint, TXT, or Markdown lecture materials |
| 🔧 **Settings** | Human-in-the-Loop (HITL) question validation and system management |
| 🤖 **Agent Routing** | Automatically routes queries to RAG, direct LLM, or web search |
| 🔄 **Self-Reflection** | Plan → Act → Observe → Reflect → Revise loop for answer quality |
| 🧠 **Conversation Memory** | Remembers past discussions across sessions with SQLite |
| 🔍 **Hybrid Retrieval** | Dense embeddings + BM25 keyword search with cross-encoder reranking |
| 📊 **Multi-Hop Reasoning** | Decomposes complex queries into sub-queries for better synthesis |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                     │
│  ┌───────────┬───────────┬──────────────┬────────────────┐  │
│  │Study Chat │ Exam Mode │Upload Notes  │    Settings    │  │
│  └─────┬─────┴─────┬─────┴──────┬───────┴───────┬────────┘  │
│        │           │            │               │            │
├────────┼───────────┼────────────┼───────────────┼────────────┤
│        ▼           ▼            ▼               ▼            │
│   ┌──────────────────────────────────────────────────┐      │
│   │                 FastAPI Backend                  │      │
│   │  ┌─────────┐ ┌─────────┐ ┌──────────┐  ┌────────┐ │      │
│   │  │  Agent  │ │Quiz Mode│ │  Ingest  │  │Settings│ │      │
│   │  │ Router  │ │(Student)│ │ Pipeline │  │ HITL  │ │      │
│   │  └────┬────┘ └─────────┘ └────┬─────┘  └───────┘ │      │
│   └───────┼───────────────────────┼──────────────────┘      │
│           │                       │                         │
│   ┌───────▼───────────────────────▼─────┐                   │
│   │         Hybrid Retriever            │                   │
│   │  Dense (ChromaDB) + Sparse (BM25)   │                   │
│   │      + Cross-Encoder Reranker       │                   │
│   └───────────────┬─────────────────────┘                   │
│                   │                                         │
│   ┌───────────────▼─────────────────────┐                   │
│   │       Google Gemini API             │                   │
│   │  LLM: gemini-2.5-flash              │                   │
│   │  Embeddings: gemini-embedding-001   │                   │
│   └─────────────────────────────────────┘                   │
│                                                             │
│   ┌─────────────────────────────────────┐                   │
│   │         Storage Layer               │                   │
│   │  ChromaDB │ SQLite (Memory+Quiz)    │                   │
│   └─────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Google Gemini API key** (free tier) — get one at [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Clone & install dependencies

```bash
git clone <repo-url>
cd LLM_Project

# Install Python backend dependencies
pip install -r requirements.txt

# Install Node.js frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Set up your API key

```bash
# Copy the example env file
copy .env.example .env
```

Edit `.env` and add your Google Gemini API key:

```
GOOGLE_API_KEY=your-google-api-key-here
```

### 3. Run the application

You will need two terminal windows to run the backend and frontend separately.

**Terminal 1: Start the FastAPI Backend**
```bash
# From the root directory (activate your Python environment first)
python -m uvicorn api:app --host 0.0.0.0 --port 8001
```
The API will be available at **http://localhost:8001**.

**Terminal 2: Start the React Frontend**
```bash
# From the frontend directory
cd frontend
npm run dev
```
The app will open at **http://localhost:5173**.

### 4. Upload course materials

Navigate to **📤 Upload Notes** and drag-and-drop your lecture materials (PDF, DOCX, PPTX, TXT, or Markdown).

### 5. Start studying!

- Use **📚 Study Chat** to ask questions about your materials — your conversations are saved and resumable
- Use **📝 Exam Mode** to test yourself with AI-generated questions
- Use **🔧 Settings** to review/edit AI-generated questions (HITL)

---

## 📁 Project Structure

```
LLM_Project/
├── api.py                  # FastAPI entry point (all REST endpoints)
├── config.py               # Central configuration (API keys, model settings)
├── requirements.txt        # Python dependencies
├── .env                    # API keys (NOT tracked in git — copy from .env.example)
├── .env.example            # Template for .env
│
├── src/                    # Core backend modules
│   ├── __init__.py         # Package init with public API exports
│   ├── ingest.py           # File ETL pipeline (PDF, DOCX, PPTX, TXT → chunks)
│   ├── vectorstore.py      # ChromaDB vector store (embeddings, search, CRUD)
│   ├── retriever.py        # Hybrid retrieval (Dense + BM25 + RRF + reranking)
│   ├── agent.py            # Query router + self-reflection loop
│   ├── memory.py           # Conversation memory (SQLite, per-notebook sessions)
│   ├── quiz_mode.py        # Quiz generation + HITL validation pipeline
│   └── citations.py        # Source citation formatting
│
├── frontend/               # React + Vite frontend
│   ├── package.json        # Node.js dependencies
│   ├── vite.config.ts      # Vite build config (port 5173)
│   └── src/
│       └── app/
│           ├── App.tsx     # Root component
│           ├── routes.ts   # React Router routes
│           ├── pages/      # Notebooks, Chat, Exam, Upload, Settings, Home
│           ├── layouts/    # DashboardLayout (per-notebook sidebar)
│           ├── context/    # NotebookContext (multi-notebook state)
│           └── components/ # shadcn/ui component library
│
├── prompts/                # LLM prompt templates
│   ├── system_prompt.txt   # Main system persona
│   ├── routing_prompt.txt  # Query classification
│   ├── reflection_prompt.txt # Answer self-evaluation
│   └── quiz_prompt.txt     # Question generation
│
├── data/                   # Data directories (uploads not tracked in git)
│   └── raw/                # Uploaded files (PDF, DOCX, PPTX, TXT, MD)
│
└── db/                     # Persistent storage (auto-created on first run)
    ├── chroma/             # ChromaDB vector database
    ├── memory.db           # Conversation memory (SQLite)
    └── quiz.db             # Question bank (SQLite)
```

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **LLM** | Google Gemini 2.5 Flash (free tier) |
| **Embeddings** | Google Gemini Embedding 001 |
| **Framework** | LangChain 0.3+ |
| **Vector Store** | ChromaDB |
| **Sparse Search** | BM25 (rank-bm25) |
| **Reranker** | cross-encoder/ms-marco-MiniLM-L-6-v2 |
| **Frontend** | React 18 + Vite + shadcn/ui + Tailwind CSS |
| **Backend API** | FastAPI + Uvicorn |
| **Memory/Quiz DB** | SQLite |
| **PDF Processing** | PyPDF |

---

## ⚙️ Configuration

All settings are centralized in `config.py`:

| Setting | Default | Description |
|---------|---------|-------------|
| `LLM_MODEL` | `gemini-2.5-flash` | Google Gemini model for generation |
| `EMBEDDING_MODEL` | `models/gemini-embedding-001` | Embedding model |
| `CHUNK_SIZE` | `500` | Characters per text chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between chunks |
| `TOP_K_RETRIEVAL` | `10` | Initial retrieval candidates |
| `TOP_K_RERANK` | `5` | Final results after reranking |
| `MAX_REFLECTION_ITERATIONS` | `2` | Max self-reflection loops |
| `CONFIDENCE_THRESHOLD` | `0.6` | Minimum answer confidence |

---

## 📝 Professor's Advanced Suggestions Implemented

This project addresses the following advanced directions suggested by the course professor:

1. **Multi-Agent Routing** — Agent router classifies queries and dispatches to specialized handlers (RAG, direct, web search, quiz)
2. **Self-Reflection Loop** — Plan → Act → Observe → Reflect → Revise cycle evaluates answer quality and retries when confidence is low
3. **Human-in-the-Loop (HITL)** — Settings page enables teachers to review, edit, accept, or reject AI-generated quiz questions
4. **Hybrid Retrieval with Multi-Hop** — Combines dense and sparse retrieval with Reciprocal Rank Fusion, cross-encoder reranking, and multi-hop sub-query decomposition
5. **Long-Term Memory** — SQLite-backed conversation memory with periodic LLM-based summarization across sessions; full chat history browsable from the UI

---

## ⚠️ Rate Limits

Google Gemini's **free tier** has the following limits:

| Resource | Limit |
|----------|-------|
| LLM requests | 15 requests/minute |
| Embedding requests | 100 requests/minute |

The upload pipeline includes **automatic rate limiting** (small batches with 15s delays) and **retry logic** for 429 errors.

---

## 👥 Team — Group 12

| Member | Role | Primary Files |
|--------|------|---------------|
| Wei Xuan | Data Infrastructure | `ingest.py` |
| Jay | Storage & Embeddings | `vectorstore.py` |
| Shunren | Core RAG Logic | `retriever.py`, `agent.py` |
| Praveen | Frontend Interface | `frontend/src/` |
| Delvin | Feature Engineering | `quiz_mode.py`, `citations.py` |

---