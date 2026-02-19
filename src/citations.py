"""
citations.py - Source citation parsing and formatting.

Handles:
- Extracting source information from chunk metadata
- Formatting citations for display in chat and quiz modes

Author: Delvin (Feature Engineering)
"""
from langchain_core.documents import Document


def format_citation(metadata: dict) -> str:
    """
    Format a single citation from chunk metadata.

    Args:
        metadata: Document metadata dict with source_file, page_number, etc.

    Returns:
        Formatted citation string.
    """
    source_file = metadata.get("source_file", "Unknown Document")
    page_number = metadata.get("page_number", "?")
    section = metadata.get("section_heading", "")

    citation = f"📄 {source_file}, Page {page_number}"
    if section:
        citation += f" — {section}"

    return citation


def format_citations_block(documents: list[Document]) -> str:
    """
    Format a block of citations from a list of retrieved documents.
    Deduplicates by source file + page number.

    Returns:
        Formatted markdown block of unique citations.
    """
    seen = set()
    citations = []

    for doc in documents:
        meta = doc.metadata
        key = (meta.get("source_file", ""), meta.get("page_number", 0))

        if key not in seen:
            seen.add(key)
            citations.append(format_citation(meta))

    if not citations:
        return ""

    block = "\n\n---\n📚 **Sources Used:**\n"
    for c in citations:
        block += f"- {c}\n"

    return block


def extract_citation_for_quiz(metadata: dict) -> dict:
    """
    Extract citation info for quiz question metadata.

    Returns:
        Dict with source_doc and source_page keys.
    """
    return {
        "source_doc": metadata.get("source_file", "Unknown"),
        "source_page": metadata.get("page_number", 0),
    }
