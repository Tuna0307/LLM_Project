"""
retriever.py - Hybrid Retrieval with BM25 + Dense Embeddings + Reranking.

Implements:
- Dense retrieval via ChromaDB (embedding similarity)
- Sparse retrieval via BM25
- Reciprocal Rank Fusion to merge results
- Cross-encoder reranking for final candidate selection
- Multi-hop retrieval for topic synthesis

Author: Shunren (Core RAG Logic)
"""
import json
from typing import Optional

from rank_bm25 import BM25Okapi
from langchain_core.documents import Document
from langchain_google_genai import ChatGoogleGenerativeAI

from src import vectorstore
import config


# ── BM25 Index Management ───────────────────────────────────────────────────

class BM25Index:
    """Maintains a BM25 index over the document corpus for keyword search."""

    def __init__(self):
        self.documents: list[Document] = []
        self.bm25: Optional[BM25Okapi] = None

    def build_from_vectorstore(self, collection_name: Optional[str] = None):
        """Build BM25 index from all documents in the vector store."""
        vs = vectorstore.get_vectorstore(collection_name)
        # Retrieve all documents from ChromaDB
        results = vs.get()

        if results and results.get("documents"):
            self.documents = []
            for i, doc_text in enumerate(results["documents"]):
                metadata = results["metadatas"][i] if results.get("metadatas") else {}
                self.documents.append(
                    Document(page_content=doc_text, metadata=metadata)
                )

            # Build BM25 index
            tokenized_docs = [doc.page_content.lower().split() for doc in self.documents]
            self.bm25 = BM25Okapi(tokenized_docs)
            print(f"📊 BM25 index built with {len(self.documents)} documents")

    def search(self, query: str, k: int = 10) -> list[Document]:
        """Search using BM25 keyword matching."""
        if self.bm25 is None or not self.documents:
            return []

        tokenized_query = query.lower().split()
        scores = self.bm25.get_scores(tokenized_query)

        # Get top-k indices
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]

        return [self.documents[i] for i in top_indices if scores[i] > 0]


# Global BM25 index instance
_bm25_index = BM25Index()


def get_bm25_index() -> BM25Index:
    """Get the global BM25 index, building it if needed."""
    if _bm25_index.bm25 is None:
        _bm25_index.build_from_vectorstore()
    return _bm25_index


def rebuild_bm25_index(collection_name: Optional[str] = None):
    """Force rebuild of the BM25 index (call after adding new documents)."""
    _bm25_index.build_from_vectorstore(collection_name)


# ── Reciprocal Rank Fusion ──────────────────────────────────────────────────

def reciprocal_rank_fusion(
    results_lists: list[list[Document]],
    k: int = 60,
) -> list[Document]:
    """
    Merge multiple ranked result lists using Reciprocal Rank Fusion (RRF).

    RRF score = sum(1 / (k + rank)) over all lists where the document appears.

    Args:
        results_lists: List of ranked document lists.
        k: RRF constant (default 60).

    Returns:
        Merged and re-ranked list of documents.
    """
    # Use page_content as key for deduplication
    doc_scores: dict[str, float] = {}
    doc_map: dict[str, Document] = {}

    for result_list in results_lists:
        for rank, doc in enumerate(result_list):
            key = doc.page_content[:200]  # Use first 200 chars as key
            if key not in doc_map:
                doc_map[key] = doc
                doc_scores[key] = 0.0
            doc_scores[key] += 1.0 / (k + rank + 1)

    # Sort by RRF score descending
    sorted_keys = sorted(doc_scores.keys(), key=lambda x: doc_scores[x], reverse=True)

    return [doc_map[key] for key in sorted_keys]


# ── Reranking ───────────────────────────────────────────────────────────────

def rerank_documents(
    query: str,
    documents: list[Document],
    top_k: int = None,
) -> list[Document]:
    """
    Rerank documents using a cross-encoder model.

    Falls back to the original order if the cross-encoder is not available.
    """
    if top_k is None:
        top_k = config.TOP_K_RERANK

    if not documents:
        return []

    try:
        from sentence_transformers import CrossEncoder

        model = CrossEncoder(config.RERANKER_MODEL)
        pairs = [(query, doc.page_content) for doc in documents]
        scores = model.predict(pairs)

        # Sort by score descending
        scored_docs = sorted(
            zip(documents, scores), key=lambda x: x[1], reverse=True
        )
        return [doc for doc, _ in scored_docs[:top_k]]

    except Exception as e:
        print(f"⚠️  Reranker unavailable ({e}), using original ranking")
        return documents[:top_k]


# ── Multi-Hop Retrieval ─────────────────────────────────────────────────────

def generate_sub_queries(query: str) -> list[str]:
    """
    Generate sub-queries for multi-hop retrieval.
    Breaks a complex question into simpler sub-questions.
    """
    llm = ChatGoogleGenerativeAI(
        model=config.LLM_MODEL,
        temperature=0.0,
        google_api_key=config.GOOGLE_API_KEY,
    )

    prompt = f"""Given the following complex question, generate 2-3 simpler sub-questions
that would help gather all the context needed to answer it comprehensively.

Original question: {query}

Respond with ONLY a JSON array of strings, e.g.:
["sub-question 1", "sub-question 2", "sub-question 3"]"""

    response = llm.invoke(prompt)

    try:
        sub_queries = json.loads(response.content)
        if isinstance(sub_queries, list):
            return sub_queries
    except (json.JSONDecodeError, AttributeError):
        pass

    # Fallback: just use the original query
    return [query]


# ── Main Hybrid Retrieval ───────────────────────────────────────────────────

def hybrid_retrieve(
    query: str,
    k: int = None,
    filters: Optional[dict] = None,
    use_reranker: bool = True,
    multi_hop: bool = False,
    collection_name: Optional[str] = None,
) -> list[Document]:
    """
    Perform hybrid retrieval combining dense + sparse search.

    Pipeline:
    1. (Optional) Generate sub-queries for multi-hop retrieval
    2. Dense retrieval from ChromaDB
    3. Sparse retrieval from BM25
    4. Reciprocal Rank Fusion to merge
    5. (Optional) Cross-encoder reranking

    Args:
        query: User's question.
        k: Number of final results.
        filters: Optional metadata filters.
        use_reranker: Whether to apply cross-encoder reranking.
        multi_hop: Whether to use multi-hop retrieval.
        collection_name: Target vector store collection.

    Returns:
        List of relevant Document objects.
    """
    if k is None:
        k = config.TOP_K_RERANK

    # Step 1: Determine queries
    if multi_hop:
        queries = generate_sub_queries(query)
        queries.append(query)  # Include original query too
    else:
        queries = [query]

    all_dense_results = []
    all_sparse_results = []

    for q in queries:
        # Step 2: Dense retrieval
        dense_results = vectorstore.similarity_search(
            q, k=config.TOP_K_RETRIEVAL, filters=filters, collection_name=collection_name
        )
        all_dense_results.extend(dense_results)

        # Step 3: Sparse retrieval (BM25)
        bm25 = get_bm25_index()
        sparse_results = bm25.search(q, k=config.TOP_K_RETRIEVAL)
        all_sparse_results.extend(sparse_results)

    # Step 4: Merge with RRF
    merged = reciprocal_rank_fusion([all_dense_results, all_sparse_results])

    # Step 5: Rerank
    if use_reranker and merged:
        final_results = rerank_documents(query, merged, top_k=k)
    else:
        final_results = merged[:k]

    return final_results
