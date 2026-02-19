"""
config.py - Central configuration for the IRRA project.
Loads environment variables and defines all tunable parameters.
"""
import os

# Suppress TensorFlow oneDNN warnings (conflicts with sentence-transformers in Anaconda)
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from dotenv import load_dotenv

load_dotenv()

# ── API Keys ──────────────────────────────────────────────────────────────────
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# ── LLM Settings ─────────────────────────────────────────────────────────────
LLM_MODEL = "gemini-2.0-flash"     # Google Gemini free-tier model
LLM_TEMPERATURE = 0.3              # Low temperature for factual accuracy
LLM_MAX_TOKENS = 1024              # Max tokens per response

# ── Embedding Settings ───────────────────────────────────────────────────────
EMBEDDING_MODEL = "models/gemini-embedding-001"  # Google Gemini embedding model

# ── Chunking Settings ────────────────────────────────────────────────────────
CHUNK_SIZE = 500                   # Characters per chunk
CHUNK_OVERLAP = 50                 # 10% overlap between chunks
HEADING_PATTERN = r"^(#{1,3}\s|Slide\s?\d+|Topic\s?\d+|Week\s?\d+|Chapter\s?\d+|Lecture\s?\d+)"

# ── Retrieval Settings ───────────────────────────────────────────────────────
TOP_K_RETRIEVAL = 10               # Initial candidates from vector search
TOP_K_RERANK = 5                   # Final results after reranking
BM25_WEIGHT = 0.3                  # Weight for BM25 in hybrid retrieval
DENSE_WEIGHT = 0.7                 # Weight for dense embeddings
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

# ── Agent Settings ───────────────────────────────────────────────────────────
MAX_REFLECTION_ITERATIONS = 2      # Max Plan→Act→Reflect loops
CONFIDENCE_THRESHOLD = 0.6         # Min confidence to accept an answer

# ── Memory Settings ──────────────────────────────────────────────────────────
MEMORY_DB_PATH = os.path.join("db", "memory.db")
SUMMARY_INTERVAL = 5               # Summarize conversation every N turns

# ── ChromaDB Settings ────────────────────────────────────────────────────────
CHROMA_PERSIST_DIR = os.path.join("db", "chroma")
DEFAULT_COLLECTION = "sit_notes"

# ── Quiz Settings ────────────────────────────────────────────────────────────
QUIZ_QUESTIONS_PER_BATCH = 5       # Number of questions generated at once
QUIZ_DB_PATH = os.path.join("db", "quiz.db")

# ── Paths ────────────────────────────────────────────────────────────────────
RAW_DATA_DIR = os.path.join("data", "raw")
PROCESSED_DATA_DIR = os.path.join("data", "processed")
PROMPTS_DIR = "prompts"
