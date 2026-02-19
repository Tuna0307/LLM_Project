# 🎓 IRRA — Intelligent RAG Revision Assistant

An AI-powered study companion for university students, built with **Retrieval-Augmented Generation (RAG)** and **Google Gemini**.

**Group 12 | AAI3008 Large Language Models**

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📚 **Study Chat** | Ask questions grounded in your lecture materials with source citations |
| 📝 **Exam Mode** | Practice with AI-generated MCQ, True/False, and Short Answer questions |
| 📤 **Upload Notes** | Upload PDF lecture slides, tutorials, and lab manuals |
| 🔧 **Admin Dashboard** | Human-in-the-Loop (HITL) question validation and system management |
| 🤖 **Agent Routing** | Automatically routes queries to RAG, direct LLM, or web search |
| 🔄 **Self-Reflection** | Plan → Act → Observe → Reflect → Revise loop for answer quality |
| 🧠 **Conversation Memory** | Remembers past discussions across sessions with SQLite |
| 🔍 **Hybrid Retrieval** | Dense embeddings + BM25 keyword search with cross-encoder reranking |
| 📊 **Multi-Hop Reasoning** | Decomposes complex queries into sub-queries for better synthesis |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Streamlit Frontend                        │
│  ┌───────────┬───────────┬──────────────┬────────────────┐  │
│  │Study Chat │ Exam Mode │Upload Notes  │Admin Dashboard │  │
│  └─────┬─────┴─────┬─────┴──────┬───────┴───────┬────────┘  │
│        │           │            │               │            │
├────────┼───────────┼────────────┼───────────────┼────────────┤
│        ▼           ▼            ▼               ▼            │
│   ┌─────────┐ ┌─────────┐ ┌──────────┐  ┌───────────────┐  │
│   │  Agent   │ │Quiz Mode│ │  Ingest  │  │  Quiz Mode    │  │
│   │ Router + │ │(Student)│ │ Pipeline │  │  (Admin HITL) │  │
│   │Reflection│ │         │ │          │  │               │  │
│   └────┬─────┘ └─────────┘ └────┬─────┘  └───────────────┘  │
│        │                        │                            │
│   ┌────▼────────────────────────▼─────┐                     │
│   │         Hybrid Retriever          │                     │
│   │  Dense (ChromaDB) + Sparse (BM25) │                     │
│   │      + Cross-Encoder Reranker     │                     │
│   └────────────┬──────────────────────┘                     │
│                │                                             │
│   ┌────────────▼──────────────────────┐                     │
│   │       Google Gemini API           │                     │
│   │  LLM: gemini-2.0-flash           │                     │
│   │  Embeddings: gemini-embedding-001 │                     │
│   └───────────────────────────────────┘                     │
│                                                              │
│   ┌──────────────────────────────────┐                      │
│   │         Storage Layer            │                      │
│   │  ChromaDB │ SQLite (Memory+Quiz) │                      │
│   └──────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+**
- **Google Gemini API key** (free tier) — get one at [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Clone & install dependencies

```bash
git clone <repo-url>
cd LLM-Project
pip install -r requirements.txt
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

### 3. Run the app

```bash
streamlit run app.py
```

The app will open at **http://localhost:8501**.

### 4. Upload course materials

Navigate to **📤 Upload Notes** and drag-and-drop your PDF lecture slides.

### 5. Start studying!

- Use **📚 Study Chat** to ask questions about your materials
- Use **📝 Exam Mode** to test yourself with AI-generated questions
- Use **🔧 Admin Dashboard** to review/edit AI-generated questions (HITL)

---

## 📁 Project Structure

```
LLM Project/
├── app.py                  # Streamlit entry point (landing page)
├── config.py               # Central configuration (API keys, model settings)
├── requirements.txt        # Python dependencies
├── .env                    # API keys (not tracked in git)
├── .env.example            # Template for .env
│
├── src/                    # Core backend modules
│   ├── __init__.py         # Package init with public API exports
│   ├── ingest.py           # PDF ETL pipeline (extract → clean → chunk → enrich)
│   ├── vectorstore.py      # ChromaDB vector store (embeddings, search, CRUD)
│   ├── retriever.py        # Hybrid retrieval (Dense + BM25 + RRF + reranking)
│   ├── agent.py            # Query router + self-reflection loop
│   ├── memory.py           # Conversation memory (SQLite, summaries)
│   ├── quiz_mode.py        # Quiz generation + HITL validation pipeline
│   └── citations.py        # Source citation formatting
│
├── pages/                  # Streamlit multi-page app
│   ├── 1_📚_Study_Chat.py  # RAG-powered Q&A with citations
│   ├── 2_📝_Exam_Mode.py   # Interactive quiz interface
│   ├── 3_📤_Upload_Notes.py # PDF upload & indexing
│   └── 4_🔧_Admin_Dashboard.py # HITL question management
│
├── prompts/                # LLM prompt templates
│   ├── system_prompt.txt   # Main system persona
│   ├── routing_prompt.txt  # Query classification
│   ├── reflection_prompt.txt # Answer self-evaluation
│   ├── quiz_prompt.txt     # Question generation
│   └── citation_prompt.txt # Citation formatting
│
├── data/                   # Data directories
│   ├── raw/                # Uploaded PDFs
│   └── processed/          # Processed chunks (optional cache)
│
└── db/                     # Persistent storage
    ├── chroma/             # ChromaDB vector database
    ├── memory.db           # Conversation memory (SQLite)
    └── quiz.db             # Question bank (SQLite)
```

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **LLM** | Google Gemini 2.0 Flash (free tier) |
| **Embeddings** | Google Gemini Embedding 001 |
| **Framework** | LangChain 0.3+ |
| **Vector Store** | ChromaDB |
| **Sparse Search** | BM25 (rank-bm25) |
| **Reranker** | cross-encoder/ms-marco-MiniLM-L-6-v2 |
| **Frontend** | Streamlit |
| **Memory/Quiz DB** | SQLite |
| **PDF Processing** | PyPDF |

---

## ⚙️ Configuration

All settings are centralized in `config.py`:

| Setting | Default | Description |
|---------|---------|-------------|
| `LLM_MODEL` | `gemini-2.0-flash` | Google Gemini model for generation |
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
3. **Human-in-the-Loop (HITL)** — Admin dashboard enables teachers to review, edit, accept, or reject AI-generated quiz questions
4. **Hybrid Retrieval with Multi-Hop** — Combines dense and sparse retrieval with Reciprocal Rank Fusion, cross-encoder reranking, and multi-hop sub-query decomposition
5. **Long-Term Memory** — SQLite-backed conversation memory with periodic LLM-based summarization across sessions

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
| Praveen | Frontend Interface | `app.py`, `pages/` |
| Delvin | Feature Engineering | `quiz_mode.py`, `citations.py` |

---

## 📄 License

This project is developed for educational purposes as part of the AAI3008 module at Singapore Institute of Technology (SIT).
