"""
📚 Study Chat - Ask questions about your course materials.
"""
import config  # Must be first — sets TF environment variables
import streamlit as st
from src.agent import handle_query
from src.memory import create_session, get_messages

# ── Page Config ─────────────────────────────────────────────────────────────
st.set_page_config(page_title="IRRA - Study Chat", page_icon="📚", layout="wide")

st.markdown("""
<style>
    .stApp { background: linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #24243e 100%); }
    [data-testid="stSidebar"] { background: linear-gradient(180deg, #1a1a3e 0%, #0f0c29 100%); }
    .chat-header {
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2rem;
        font-weight: 700;
    }
    .route-badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-left: 8px;
    }
    .route-rag { background: rgba(102, 126, 234, 0.2); color: #667eea; }
    .route-direct { background: rgba(72, 187, 120, 0.2); color: #48bb78; }
    .route-web { background: rgba(237, 137, 54, 0.2); color: #ed8936; }
</style>
""", unsafe_allow_html=True)

st.markdown('<p class="chat-header">📚 Study Chat</p>', unsafe_allow_html=True)
st.markdown("Ask anything about your uploaded course materials. I'll find the answer and cite the sources!")

# ── Session Management ──────────────────────────────────────────────────────
if "session_id" not in st.session_state:
    st.session_state.session_id = create_session()

if "chat_messages" not in st.session_state:
    st.session_state.chat_messages = []

# ── Sidebar Options ─────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 💬 Chat Settings")
    
    # Metadata filters
    st.markdown("**Filter by:**")
    filter_topic = st.text_input("Topic", placeholder="e.g., Preprocessing")
    filter_week = st.number_input("Week", min_value=0, max_value=14, value=0, help="0 = no filter")
    
    filters = {}
    if filter_topic:
        filters["topic"] = filter_topic
    if filter_week > 0:
        filters["week"] = filter_week
    
    st.markdown("---")
    
    if st.button("🗑️ Clear Chat"):
        st.session_state.chat_messages = []
        st.session_state.session_id = create_session()
        st.rerun()

# ── Chat Display ────────────────────────────────────────────────────────────
for msg in st.session_state.chat_messages:
    with st.chat_message(msg["role"], avatar="🎓" if msg["role"] == "assistant" else "🧑‍🎓"):
        st.markdown(msg["content"])
        if msg.get("citations"):
            st.markdown(msg["citations"])
        if msg.get("metadata"):
            meta = msg["metadata"]
            route = meta.get("route", "rag")
            route_class = f"route-{route}"
            cols = st.columns([1, 1, 1, 3])
            with cols[0]:
                st.caption(f"🛣️ Route: {route.upper()}")
            with cols[1]:
                st.caption(f"📊 Confidence: {meta.get('confidence', 0):.0%}")
            with cols[2]:
                st.caption(f"🔄 Iterations: {meta.get('iterations', 1)}")

# ── Chat Input ──────────────────────────────────────────────────────────────
if user_input := st.chat_input("Ask about your course materials..."):
    # Display user message
    st.session_state.chat_messages.append({"role": "user", "content": user_input})
    with st.chat_message("user", avatar="🧑‍🎓"):
        st.markdown(user_input)

    # Generate response
    with st.chat_message("assistant", avatar="🎓"):
        with st.spinner("🔍 Searching course materials..."):
            result = handle_query(
                query=user_input,
                session_id=st.session_state.session_id,
                filters=filters if filters else None,
            )

        st.markdown(result["answer"])
        if result.get("citations"):
            st.markdown(result["citations"])

        # Show metadata
        route = result.get("route", "rag")
        cols = st.columns([1, 1, 1, 3])
        with cols[0]:
            st.caption(f"🛣️ Route: {route.upper()}")
        with cols[1]:
            st.caption(f"📊 Confidence: {result.get('confidence', 0):.0%}")
        with cols[2]:
            st.caption(f"🔄 Iterations: {result.get('iterations', 1)}")

    # Save to session state
    st.session_state.chat_messages.append({
        "role": "assistant",
        "content": result["answer"],
        "citations": result.get("citations", ""),
        "metadata": {
            "route": result.get("route"),
            "confidence": result.get("confidence"),
            "iterations": result.get("iterations"),
        },
    })
