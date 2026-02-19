"""
IRRA - Intelligent RAG Revision Assistant
Main Streamlit application entry point.
"""
import config  # Must be first — sets TF environment variables
import streamlit as st

# ── Page Configuration ──────────────────────────────────────────────────────
st.set_page_config(
    page_title="IRRA - Intelligent RAG Revision Assistant",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ──────────────────────────────────────────────────────────────
st.markdown("""
<style>
    /* Main theme */
    .stApp {
        background: linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #24243e 100%);
    }
    
    /* Sidebar styling */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #1a1a3e 0%, #0f0c29 100%);
        border-right: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    /* Header gradient text */
    .main-header {
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 3rem;
        font-weight: 800;
        text-align: center;
        margin-bottom: 0;
    }
    
    .sub-header {
        color: #a0a0b0;
        text-align: center;
        font-size: 1.1rem;
        margin-top: 0;
    }
    
    /* Feature cards */
    .feature-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 1.5rem;
        margin: 0.5rem 0;
        backdrop-filter: blur(10px);
        transition: transform 0.2s, border-color 0.2s;
    }
    
    .feature-card:hover {
        transform: translateY(-2px);
        border-color: rgba(102, 126, 234, 0.5);
    }
    
    .feature-icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }
    
    .feature-title {
        color: #e0e0f0;
        font-size: 1.2rem;
        font-weight: 600;
        margin-bottom: 0.3rem;
    }
    
    .feature-desc {
        color: #8888a0;
        font-size: 0.9rem;
    }
    
    /* Stats row */
    .stat-box {
        background: rgba(102, 126, 234, 0.15);
        border: 1px solid rgba(102, 126, 234, 0.3);
        border-radius: 12px;
        padding: 1rem;
        text-align: center;
    }
    
    .stat-number {
        font-size: 2rem;
        font-weight: 700;
        background: linear-gradient(90deg, #667eea, #764ba2);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    
    .stat-label {
        color: #8888a0;
        font-size: 0.85rem;
    }
</style>
""", unsafe_allow_html=True)

# ── Main Page Content ───────────────────────────────────────────────────────
st.markdown('<h1 class="main-header">🎓 IRRA</h1>', unsafe_allow_html=True)
st.markdown('<p class="sub-header">Intelligent RAG Revision Assistant — Your AI-Powered Study Buddy</p>', unsafe_allow_html=True)

st.markdown("---")

# Feature cards
col1, col2 = st.columns(2)

with col1:
    st.markdown("""
    <div class="feature-card">
        <div class="feature-icon">📚</div>
        <div class="feature-title">Study Chat</div>
        <div class="feature-desc">Ask questions about your course materials. Get accurate, cited answers grounded in your lecture notes.</div>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("""
    <div class="feature-card">
        <div class="feature-icon">📤</div>
        <div class="feature-title">Upload Notes</div>
        <div class="feature-desc">Upload PDF lecture slides, tutorials, and lab manuals. IRRA processes and indexes them automatically.</div>
    </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown("""
    <div class="feature-card">
        <div class="feature-icon">📝</div>
        <div class="feature-title">Exam Mode</div>
        <div class="feature-desc">Test yourself with AI-generated practice questions. Track your progress and identify weak areas.</div>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("""
    <div class="feature-card">
        <div class="feature-icon">🔧</div>
        <div class="feature-title">Admin Dashboard</div>
        <div class="feature-desc">Review and validate AI-generated questions. Manage the question bank with human oversight.</div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("---")

# System stats
try:
    from src.vectorstore import get_collection_stats
    from src.quiz_mode import get_quiz_stats
    
    vec_stats = get_collection_stats()
    quiz_stats = get_quiz_stats()
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown(f"""
        <div class="stat-box">
            <div class="stat-number">{vec_stats.get('count', 0)}</div>
            <div class="stat-label">Indexed Chunks</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown(f"""
        <div class="stat-box">
            <div class="stat-number">{quiz_stats.get('accepted', 0)}</div>
            <div class="stat-label">Quiz Questions</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        st.markdown(f"""
        <div class="stat-box">
            <div class="stat-number">{quiz_stats.get('pending', 0)}</div>
            <div class="stat-label">Pending Review</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col4:
        accuracy = quiz_stats.get('accuracy', 0)
        st.markdown(f"""
        <div class="stat-box">
            <div class="stat-number">{accuracy:.0f}%</div>
            <div class="stat-label">Quiz Accuracy</div>
        </div>
        """, unsafe_allow_html=True)

except Exception:
    st.info("📊 Upload some notes to get started! Use the **Upload Notes** page in the sidebar.")

# ── Sidebar ─────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 🎓 IRRA")
    st.markdown("**Intelligent RAG Revision Assistant**")
    st.markdown("---")
    st.markdown("Built by **Group 12** for AAI3008")
    st.markdown("---")
    st.markdown("""
    **How to use:**
    1. 📤 Upload your lecture PDFs
    2. 📚 Chat to study
    3. 📝 Test yourself in Exam Mode
    """)
