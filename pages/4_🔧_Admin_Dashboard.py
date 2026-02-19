"""
🔧 Admin Dashboard - HITL Question Validation and System Management.
"""
import config  # Must be first — sets TF environment variables
import json
import streamlit as st
from src.quiz_mode import (
    generate_questions,
    save_generated_questions,
    get_pending_questions,
    review_question,
    get_quiz_stats,
    get_accepted_questions,
)
from src.vectorstore import get_collection_stats

# ── Page Config ─────────────────────────────────────────────────────────────
st.set_page_config(page_title="IRRA - Admin Dashboard", page_icon="🔧", layout="wide")

st.markdown("""
<style>
    .stApp { background: linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #24243e 100%); }
    [data-testid="stSidebar"] { background: linear-gradient(180deg, #1a1a3e 0%, #0f0c29 100%); }
    .admin-header {
        background: linear-gradient(90deg, #fa709a 0%, #fee140 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2rem;
        font-weight: 700;
    }
    .pending-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 1.5rem;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)

st.markdown('<p class="admin-header">🔧 Admin Dashboard</p>', unsafe_allow_html=True)
st.markdown("Review AI-generated questions, manage the question bank, and monitor system health.")

st.markdown("---")

# ── System Stats ────────────────────────────────────────────────────────────
st.markdown("### 📊 System Overview")

col1, col2, col3, col4, col5 = st.columns(5)

try:
    vec_stats = get_collection_stats()
    quiz_stats = get_quiz_stats()

    with col1:
        st.metric("📦 Indexed Chunks", vec_stats.get("count", 0))
    with col2:
        st.metric("📝 Total Questions", quiz_stats.get("total_questions", 0))
    with col3:
        st.metric("⏳ Pending Review", quiz_stats.get("pending", 0))
    with col4:
        st.metric("✅ Accepted", quiz_stats.get("accepted", 0))
    with col5:
        st.metric("❌ Rejected", quiz_stats.get("rejected", 0))
except Exception:
    st.info("No data available yet.")

st.markdown("---")

# ── Generate Questions ──────────────────────────────────────────────────────
st.markdown("### 🤖 Generate New Questions")

gen_col1, gen_col2 = st.columns([2, 1])
with gen_col1:
    gen_topic = st.text_input("Topic to generate questions for", placeholder="e.g., Neural Networks, Preprocessing")
with gen_col2:
    gen_count = st.slider("Number of questions", 3, 10, 5)

if st.button("🎲 Generate Questions", type="primary"):
    with st.spinner("🤖 Generating questions from course materials..."):
        questions = generate_questions(
            topic=gen_topic if gen_topic else None,
            num_questions=gen_count,
        )

        if questions:
            saved = save_generated_questions(questions)
            st.success(f"✅ Generated and saved **{saved}** questions! They are now pending review below.")
            st.rerun()
        else:
            st.warning("⚠️ Could not generate questions. Make sure course materials are uploaded.")

st.markdown("---")

# ── Pending Review ──────────────────────────────────────────────────────────
st.markdown("### 👨‍🏫 Pending Review (Human-in-the-Loop)")

pending = get_pending_questions()

if not pending:
    st.info("✨ No questions pending review! Generate some above or all questions have been reviewed.")
else:
    st.markdown(f"**{len(pending)} question(s) awaiting review:**")

    for q in pending:
        with st.expander(f"Q{q['id']}: {q['question'][:80]}...", expanded=False):
            st.markdown(f"**Type:** {q['type'].upper()}")
            st.markdown(f"**Question:** {q['question']}")

            if q.get("options"):
                try:
                    options = json.loads(q["options"]) if isinstance(q["options"], str) else q["options"]
                    st.markdown("**Options:**")
                    for opt in options:
                        st.markdown(f"  - {opt}")
                except (json.JSONDecodeError, TypeError):
                    pass

            st.markdown(f"**Correct Answer:** {q['correct_answer']}")
            st.markdown(f"**Explanation:** {q['explanation']}")
            st.markdown(f"**Difficulty:** {q.get('difficulty', 'medium')} | **Source:** {q.get('source_doc', 'N/A')}, Page {q.get('source_page', '?')}")

            # Review actions
            review_col1, review_col2, review_col3 = st.columns(3)

            with review_col1:
                if st.button(f"✅ Accept", key=f"accept_{q['id']}"):
                    review_question(q["id"], "accept", admin_notes="Approved by admin")
                    st.success("Question accepted!")
                    st.rerun()

            with review_col2:
                if st.button(f"❌ Reject", key=f"reject_{q['id']}"):
                    review_question(q["id"], "reject", admin_notes="Rejected by admin")
                    st.warning("Question rejected.")
                    st.rerun()

            with review_col3:
                with st.popover(f"✏️ Edit", use_container_width=True):
                    edited_question = st.text_area("Edit question:", value=q["question"], key=f"edit_q_{q['id']}")
                    edited_answer = st.text_input("Edit answer:", value=q["correct_answer"], key=f"edit_a_{q['id']}")
                    edited_explanation = st.text_area("Edit explanation:", value=q["explanation"], key=f"edit_e_{q['id']}")

                    if st.button("Save & Accept", key=f"save_{q['id']}"):
                        review_question(
                            q["id"],
                            "edit",
                            admin_notes="Edited and approved by admin",
                            edited_data={
                                "question": edited_question,
                                "correct_answer": edited_answer,
                                "explanation": edited_explanation,
                            },
                        )
                        st.success("Question edited and accepted!")
                        st.rerun()

st.markdown("---")

# ── Question Bank Browser ──────────────────────────────────────────────────
st.markdown("### 📖 Accepted Question Bank")

accepted = get_accepted_questions(limit=50)

if not accepted:
    st.info("No accepted questions yet. Review pending questions above.")
else:
    st.markdown(f"**{len(accepted)} accepted question(s) in the bank:**")

    for q in accepted:
        with st.expander(f"[{q.get('difficulty', 'medium').upper()}] {q['question'][:80]}..."):
            st.markdown(f"**Answer:** {q['correct_answer']}")
            st.markdown(f"**Explanation:** {q.get('explanation', 'N/A')}")
            st.markdown(f"**Source:** {q.get('source_doc', 'N/A')}, Page {q.get('source_page', '?')}")
