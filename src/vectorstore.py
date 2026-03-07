"""
vectorstore.py - ChromaDB vector store management.

Handles:
- ChromaDB initialization with persistent storage
- Adding documents with embeddings
- Similarity search with optional metadata filtering
- Collection management for multiple modules

Author: Jay (Storage & Embeddings)
"""
import os
from typing import Optional

import chromadb
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document

import config


def get_embedding_function() -> HuggingFaceEmbeddings:
    """Get the local embedding function (sentence-transformers, runs on CPU, no API key needed)."""
    return HuggingFaceEmbeddings(
        model_name=config.EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def get_vectorstore(
    collection_name: Optional[str] = None,
) -> Chroma:
    """
    Get or create a ChromaDB vector store.

    Args:
        collection_name: Name of the collection. Defaults to config.DEFAULT_COLLECTION.

    Returns:
        A LangChain Chroma vector store instance.
    """
    if collection_name is None:
        collection_name = config.DEFAULT_COLLECTION

    # Ensure persist directory exists
    os.makedirs(config.CHROMA_PERSIST_DIR, exist_ok=True)

    embedding_fn = get_embedding_function()

    vectorstore = Chroma(
        collection_name=collection_name,
        embedding_function=embedding_fn,
        persist_directory=config.CHROMA_PERSIST_DIR,
    )

    return vectorstore


def add_documents(
    documents: list[Document],
    collection_name: Optional[str] = None,
) -> int:
    """
    Add documents to the vector store.
    Uses local sentence-transformers embeddings — no API rate limits, no delays needed.

    Args:
        documents: List of LangChain Document objects (from ingest.py).
        collection_name: Target collection name.

    Returns:
        Number of documents added.
    """
    if not documents:
        print("[WARN] No documents to add.")
        return 0

    vectorstore = get_vectorstore(collection_name)

    # Embed and add all documents in one go (local model, no rate limits)
    try:
        vectorstore.add_documents(documents)
        print(f"[OK] Added {len(documents)} documents to collection '{collection_name or config.DEFAULT_COLLECTION}'")
        return len(documents)
    except Exception as e:
        print(f"[ERR] Error adding documents: {e}")
        raise


def similarity_search(
    query: str,
    k: int = None,
    filters: Optional[dict] = None,
    collection_name: Optional[str] = None,
) -> list[Document]:
    """
    Search the vector store for similar documents.

    Args:
        query: Search query text.
        k: Number of results to return. Defaults to config.TOP_K_RETRIEVAL.
        filters: Optional metadata filters (e.g., {"week": 3, "topic": "NLP"}).
        collection_name: Target collection name.

    Returns:
        List of matching Document objects with similarity scores.
    """
    if k is None:
        k = config.TOP_K_RETRIEVAL

    vectorstore = get_vectorstore(collection_name)

    if filters:
        # Build ChromaDB where filter
        where_filter = {}
        for key, value in filters.items():
            where_filter[key] = value
        results = vectorstore.similarity_search(query, k=k, filter=where_filter)
    else:
        results = vectorstore.similarity_search(query, k=k)

    return results


def similarity_search_with_scores(
    query: str,
    k: int = None,
    filters: Optional[dict] = None,
    collection_name: Optional[str] = None,
) -> list[tuple[Document, float]]:
    """
    Search with relevance scores (useful for confidence thresholding).

    Returns:
        List of (Document, score) tuples sorted by relevance.
    """
    if k is None:
        k = config.TOP_K_RETRIEVAL

    vectorstore = get_vectorstore(collection_name)

    if filters:
        results = vectorstore.similarity_search_with_relevance_scores(
            query, k=k, filter=filters
        )
    else:
        results = vectorstore.similarity_search_with_relevance_scores(query, k=k)

    return results


def get_collection_stats(
    collection_name: Optional[str] = None,
    notebook_id: Optional[str] = None,
) -> dict:
    """
    Get statistics about a collection.
    If notebook_id is provided, only count chunks belonging to that notebook.

    Returns:
        Dictionary with collection info (count, name, etc.)
    """
    if collection_name is None:
        collection_name = config.DEFAULT_COLLECTION

    client = chromadb.PersistentClient(path=config.CHROMA_PERSIST_DIR)

    try:
        collection = client.get_collection(collection_name)
        if notebook_id:
            result = collection.get(where={"notebook_id": {"$eq": notebook_id}}, include=["metadatas"])
            count = len(result.get("ids", []))
        else:
            count = collection.count()
        return {
            "name": collection_name,
            "count": count,
        }
    except Exception:
        return {
            "name": collection_name,
            "count": 0,
        }


def get_uploaded_documents(
    collection_name: Optional[str] = None,
    notebook_id: Optional[str] = None,
) -> list:
    """
    Return a deduplicated list of source files that have been indexed,
    along with their metadata and chunk counts.

    Args:
        notebook_id: If provided, only return documents belonging to this notebook.

    Returns:
        List of dicts: [{source_file, topic, doc_type, chunk_count, notebook_id}, ...]
    """
    if collection_name is None:
        collection_name = config.DEFAULT_COLLECTION

    client = chromadb.PersistentClient(path=config.CHROMA_PERSIST_DIR)
    try:
        collection = client.get_collection(collection_name)
        get_kwargs: dict = {"include": ["metadatas"]}
        if notebook_id:
            get_kwargs["where"] = {"notebook_id": {"$eq": notebook_id}}
        result = collection.get(**get_kwargs)
        docs: dict = {}
        for meta in result.get("metadatas", []):
            if not meta:
                continue
            key = meta.get("source_file", "Unknown")
            if key not in docs:
                docs[key] = {
                    "source_file": key,
                    "topic": meta.get("topic", ""),
                    "doc_type": meta.get("doc_type", "lecture"),
                    "notebook_id": meta.get("notebook_id", ""),
                    "chunk_count": 0,
                }
            docs[key]["chunk_count"] += 1
        return sorted(docs.values(), key=lambda d: d["source_file"])
    except Exception:
        return []


def get_document_metadata_values(collection_name: Optional[str] = None) -> dict:
    """
    Get unique week and topic metadata values from all indexed documents.
    Used by the frontend to build dynamic filter dropdowns.

    Returns:
        Dictionary with sorted lists: {"weeks": [1, 2, ...], "topics": ["Intro", ...]}
    """
    if collection_name is None:
        collection_name = config.DEFAULT_COLLECTION

    client = chromadb.PersistentClient(path=config.CHROMA_PERSIST_DIR)
    try:
        collection = client.get_collection(collection_name)
        result = collection.get(include=["metadatas"])
        weeks: set = set()
        topics: set = set()
        for meta in result.get("metadatas", []):
            if meta:
                if "week" in meta and meta["week"] is not None:
                    try:
                        weeks.add(int(meta["week"]))
                    except (ValueError, TypeError):
                        pass
                if "topic" in meta and meta["topic"]:
                    topics.add(str(meta["topic"]))
        return {
            "weeks": sorted(list(weeks)),
            "topics": sorted(list(topics)),
        }
    except Exception:
        return {"weeks": [], "topics": []}


def list_collections() -> list[str]:
    """List all available collections in the vector store."""
    client = chromadb.PersistentClient(path=config.CHROMA_PERSIST_DIR)
    collections = client.list_collections()
    return [c.name for c in collections]


def delete_collection(collection_name: str) -> bool:
    """Delete a collection from the vector store."""
    client = chromadb.PersistentClient(path=config.CHROMA_PERSIST_DIR)
    try:
        client.delete_collection(collection_name)
        print(f"[DEL] Deleted collection '{collection_name}'")
        return True
    except Exception as e:
        print(f"[ERR] Error deleting collection: {e}")
        return False


def delete_documents_by_source(
    source_file: str,
    collection_name: Optional[str] = None,
    notebook_id: Optional[str] = None,
) -> int:
    """
    Delete all chunks whose metadata source_file matches the given filename.
    If notebook_id is provided, only delete chunks belonging to that notebook.

    Returns:
        Number of chunks deleted.
    """
    if collection_name is None:
        collection_name = config.DEFAULT_COLLECTION

    client = chromadb.PersistentClient(path=config.CHROMA_PERSIST_DIR)
    try:
        col = client.get_collection(collection_name)
    except Exception:
        return 0  # collection doesn't exist yet

    # Build where clause - scope to notebook if provided
    if notebook_id:
        where_clause = {"$and": [{"source_file": {"$eq": source_file}}, {"notebook_id": {"$eq": notebook_id}}]}
    else:
        where_clause = {"source_file": source_file}

    # Fetch IDs of all chunks matching this source file
    results = col.get(where=where_clause)
    ids = results.get("ids", [])
    if ids:
        col.delete(ids=ids)
        print(f"[DEL] Deleted {len(ids)} chunks for '{source_file}' (notebook={notebook_id or 'any'})")
    return len(ids)
