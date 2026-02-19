"""
📤 Upload Notes - Upload and process PDF lecture materials.
"""
import config  # Must be first — sets TF environment variables
import os
import tempfile
import streamlit as st
from src.ingest import load_and_process_pdf
from src.vectorstore import add_documents, get_collection_stats, list_collections
from src.retriever import rebuild_bm25_index

# ── Page Config ─────────────────────────────────────────────────────────────
st.set_page_config(page_title="IRRA - Upload Notes", page_icon="📤", layout="wide")

st.markdown("""
<style>
    .stApp { background: linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #24243e 100%); }
    [data-testid="stSidebar"] { background: linear-gradient(180deg, #1a1a3e 0%, #0f0c29 100%); }
    .upload-header {
        background: linear-gradient(90deg, #43e97b 0%, #38f9d7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2rem;
        font-weight: 700;
    }
</style>
""", unsafe_allow_html=True)

st.markdown('<p class="upload-header">📤 Upload Notes</p>', unsafe_allow_html=True)
st.markdown("Upload your SIT lecture slides, tutorials, and lab manuals. IRRA will process and index them for study.")

st.markdown("---")

# ── Upload Form ─────────────────────────────────────────────────────────────
col1, col2 = st.columns([2, 1])

with col1:
    uploaded_files = st.file_uploader(
        "Drop your PDF files here",
        type=["pdf"],
        accept_multiple_files=True,
        help="Upload one or more PDF files. They will be processed and added to the knowledge base.",
    )

with col2:
    st.markdown("### 📋 Metadata (Optional)")
    meta_topic = st.text_input("Topic / Module", placeholder="e.g., Machine Learning")
    meta_week = st.number_input("Week Number", min_value=0, max_value=14, value=0, help="0 = auto-detect")
    meta_doc_type = st.selectbox("Document Type", ["lecture", "tutorial", "lab", "handbook"])

# ── Process Uploads ─────────────────────────────────────────────────────────
if uploaded_files:
    if st.button("🚀 Process & Index Files", type="primary"):
        extra_metadata = {"doc_type": meta_doc_type}
        if meta_topic:
            extra_metadata["topic"] = meta_topic
        if meta_week > 0:
            extra_metadata["week"] = meta_week

        progress_bar = st.progress(0)
        status_text = st.empty()

        all_chunks = []

        for i, uploaded_file in enumerate(uploaded_files):
            status_text.text(f"📥 Processing {uploaded_file.name}...")

            # Save to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(uploaded_file.getbuffer())
                tmp_path = tmp.name

            try:
                # Process the PDF
                chunks = load_and_process_pdf(tmp_path, extra_metadata)
                all_chunks.extend(chunks)
                status_text.text(f"✅ {uploaded_file.name}: {len(chunks)} chunks extracted")
            except Exception as e:
                st.error(f"❌ Error processing {uploaded_file.name}: {e}")
            finally:
                # Clean up temp file
                os.unlink(tmp_path)

            progress_bar.progress((i + 1) / len(uploaded_files))

        # Add to vector store
        if all_chunks:
            status_text.text("📦 Adding to knowledge base...")
            added = add_documents(all_chunks)

            # Rebuild BM25 index
            status_text.text("📊 Rebuilding search index...")
            rebuild_bm25_index()

            status_text.text("")
            st.success(f"🎉 Successfully indexed **{added}** chunks from **{len(uploaded_files)}** file(s)!")
        else:
            st.warning("⚠️ No chunks were extracted. Check if the PDFs contain readable text.")

st.markdown("---")

# ── Current Index Status ────────────────────────────────────────────────────
st.markdown("### 📊 Knowledge Base Status")

try:
    stats = get_collection_stats()
    collections = list_collections()

    col1, col2 = st.columns(2)
    with col1:
        st.metric("Total Indexed Chunks", stats.get("count", 0))
    with col2:
        st.metric("Collections", len(collections) if collections else 1)

    if collections:
        st.markdown("**Available Collections:**")
        for col_name in collections:
            col_stats = get_collection_stats(col_name)
            st.markdown(f"- `{col_name}`: {col_stats.get('count', 0)} chunks")

except Exception as e:
    st.info("📂 No documents indexed yet. Upload some PDFs to get started!")
