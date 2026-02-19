"""
IRRA — Intelligent RAG Revision Assistant
==========================================
Core backend package for the IRRA system.

Modules:
    ingest       – PDF ETL pipeline (extract, clean, chunk, enrich metadata)
    vectorstore  – ChromaDB vector store management and similarity search
    retriever    – Hybrid retrieval (Dense + BM25 + cross-encoder reranking)
    agent        – Query routing, self-reflection loop, and answer generation
    memory       – Long-term conversation memory with SQLite
    quiz_mode    – AI quiz generation and Human-in-the-Loop validation
    citations    – Source citation formatting for RAG answers
"""

__version__ = "1.0.0"
__author__ = "Group 12 — AAI3008"

# Public API — lazy imports to avoid loading everything at startup
from src.ingest import load_and_process_pdf
from src.vectorstore import (
    get_vectorstore,
    add_documents,
    similarity_search,
    get_collection_stats,
)
from src.retriever import hybrid_retrieve
from src.agent import handle_query, route_query
from src.memory import create_session, get_messages, add_message
from src.quiz_mode import generate_questions, get_accepted_questions
from src.citations import format_citation

__all__ = [
    # Ingest
    "load_and_process_pdf",
    # Vector Store
    "get_vectorstore",
    "add_documents",
    "similarity_search",
    "get_collection_stats",
    # Retrieval
    "hybrid_retrieve",
    # Agent
    "handle_query",
    "route_query",
    # Memory
    "create_session",
    "get_messages",
    "add_message",
    # Quiz
    "generate_questions",
    "get_accepted_questions",
    # Citations
    "format_citation",
]
