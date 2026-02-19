"""
ingest.py - ETL Pipeline for processing PDF lecture materials.

Handles:
- PDF text extraction using PyPDFLoader
- Regex-based noise removal (headers, footers, watermarks)
- Structure-aware semantic chunking with heading detection
- Metadata enrichment (source file, page number, topic, week, doc type)

Author: Wei Xuan (Data Infrastructure)
"""
import os
import re
from typing import Optional

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

import config


# ── Noise Patterns to Remove ────────────────────────────────────────────────
NOISE_PATTERNS = [
    r"©\s*\d{4}.*?reserved\.?",                  # Copyright notices
    r"Singapore Institute of Technology",          # SIT watermarks
    r"All [Rr]ights [Rr]eserved",                 # Rights reserved
    r"Page\s*\d+\s*(of\s*\d+)?",                  # Page numbers
    r"^\s*\d+\s*$",                                # Standalone page numbers
    r"Confidential|CONFIDENTIAL",                  # Confidentiality notices
    r"^\s*[-–—]+\s*$",                             # Separator lines
]

# Compiled regex for efficiency
_noise_re = re.compile("|".join(NOISE_PATTERNS), re.IGNORECASE | re.MULTILINE)

# Heading detection for structure-aware chunking
_heading_re = re.compile(config.HEADING_PATTERN, re.IGNORECASE | re.MULTILINE)


def clean_text(text: str) -> str:
    """Remove noise from extracted PDF text."""
    # Remove noise patterns
    cleaned = _noise_re.sub("", text)
    # Collapse multiple blank lines into one
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    # Strip leading/trailing whitespace
    return cleaned.strip()


def detect_heading(text: str) -> Optional[str]:
    """Detect section headings in text for structure-aware chunking."""
    match = _heading_re.search(text)
    if match:
        # Extract the full line containing the heading
        start = text.rfind("\n", 0, match.start()) + 1
        end = text.find("\n", match.end())
        if end == -1:
            end = len(text)
        return text[start:end].strip()
    return None


def extract_metadata_from_filename(filename: str) -> dict:
    """
    Extract metadata hints from the filename.
    Expected patterns: 'Week3_Preprocessing.pdf', 'Lecture_5_NLP.pdf', etc.
    """
    metadata = {"doc_type": "lecture"}  # default

    # Try to extract week number
    week_match = re.search(r"[Ww]eek\s*(\d+)", filename)
    if week_match:
        metadata["week"] = int(week_match.group(1))

    # Try to extract topic from filename
    name_no_ext = os.path.splitext(filename)[0]
    # Remove week/lecture prefixes to get topic
    topic = re.sub(r"[Ww]eek\s*\d+[_\s-]*", "", name_no_ext)
    topic = re.sub(r"[Ll]ecture\s*\d+[_\s-]*", "", topic)
    topic = topic.replace("_", " ").replace("-", " ").strip()
    if topic:
        metadata["topic"] = topic

    # Detect document type
    lower_name = filename.lower()
    if "tutorial" in lower_name or "tut" in lower_name:
        metadata["doc_type"] = "tutorial"
    elif "lab" in lower_name:
        metadata["doc_type"] = "lab"
    elif "handbook" in lower_name or "guide" in lower_name:
        metadata["doc_type"] = "handbook"

    return metadata


def load_and_process_pdf(
    pdf_path: str,
    extra_metadata: Optional[dict] = None,
) -> list[Document]:
    """
    Full ETL pipeline for a single PDF file.

    1. Extract text page-by-page
    2. Clean noise
    3. Split into semantic chunks with overlap
    4. Enrich with metadata

    Args:
        pdf_path: Path to the PDF file
        extra_metadata: Optional additional metadata (e.g., user-provided topic)

    Returns:
        List of Document objects ready for embedding
    """
    filename = os.path.basename(pdf_path)
    file_metadata = extract_metadata_from_filename(filename)

    # Override with user-provided metadata
    if extra_metadata:
        file_metadata.update(extra_metadata)

    # Step 1: Extract text from PDF
    loader = PyPDFLoader(pdf_path)
    raw_pages = loader.load()

    # Step 2: Clean each page
    cleaned_pages = []
    for page in raw_pages:
        cleaned_text = clean_text(page.page_content)
        if cleaned_text:  # Skip empty pages
            page.page_content = cleaned_text
            cleaned_pages.append(page)

    # Step 3: Chunk with overlap
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    all_chunks = []
    current_heading = "Introduction"  # Default heading

    for page in cleaned_pages:
        page_num = page.metadata.get("page", 0) + 1  # 1-indexed

        # Detect headings for context
        heading = detect_heading(page.page_content)
        if heading:
            current_heading = heading

        # Split this page's text
        page_chunks = text_splitter.split_text(page.page_content)

        for i, chunk_text in enumerate(page_chunks):
            # Prepend heading context to each chunk for better retrieval
            contextualized_text = f"[{current_heading}]\n{chunk_text}"

            # Build metadata
            chunk_metadata = {
                "source_file": filename,
                "page_number": page_num,
                "chunk_index": i,
                "section_heading": current_heading,
                **file_metadata,
            }

            all_chunks.append(
                Document(
                    page_content=contextualized_text,
                    metadata=chunk_metadata,
                )
            )

    return all_chunks


def ingest_directory(
    directory: Optional[str] = None,
    extra_metadata: Optional[dict] = None,
) -> list[Document]:
    """
    Process all PDF files in a directory.

    Args:
        directory: Path to directory containing PDFs. Defaults to config.RAW_DATA_DIR.
        extra_metadata: Optional metadata to apply to all files.

    Returns:
        List of all Document chunks from all PDFs.
    """
    if directory is None:
        directory = config.RAW_DATA_DIR

    all_documents = []
    pdf_files = [f for f in os.listdir(directory) if f.lower().endswith(".pdf")]

    if not pdf_files:
        print(f"⚠️  No PDF files found in {directory}")
        return all_documents

    for pdf_file in sorted(pdf_files):
        pdf_path = os.path.join(directory, pdf_file)
        print(f"📥 Processing: {pdf_file}")

        try:
            docs = load_and_process_pdf(pdf_path, extra_metadata)
            all_documents.extend(docs)
            print(f"   ✅ Generated {len(docs)} chunks")
        except Exception as e:
            print(f"   ❌ Error processing {pdf_file}: {e}")

    print(f"\n📊 Total: {len(all_documents)} chunks from {len(pdf_files)} files")
    return all_documents


if __name__ == "__main__":
    # CLI usage: python -m src.ingest
    docs = ingest_directory()
    if docs:
        print(f"\nSample chunk metadata: {docs[0].metadata}")
        print(f"Sample chunk text (first 200 chars): {docs[0].page_content[:200]}")
