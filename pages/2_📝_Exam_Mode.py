"""
📝 Exam Mode - Test yourself with practice questions.
"""
import config  # Must be first — sets TF environment variables
import streamlit as st
from src.quiz_mode import get_accepted_questions, record_attempt
from src.memory import create_session

# ── Page Config ─────────────────────────────────────────────────────────────
st.set_page_config(page_title="IRRA - Exam Mode", page_icon="📝", layout="wide")

st.markdown("""
<style>
    .stApp { background: linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #24243e 100%); }
    [data-testid="stSidebar"] { background: linear-gradient(180deg, #1a1a3e 0%, #0f0c29 100%); }
    .exam-header {
        background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2rem;
        font-weight: 700;
    }
    .question-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 1.5rem;
        margin: 1rem 0;
    }
    .score-display {
        background: rgba(102, 126, 234, 0.15);
        border: 1px solid rgba(102, 126, 234, 0.3);
        border-radius: 12px;
        padding: 1rem;
        text-align: center;
    }
</style>
""", unsafe_allow_html=True)

st.markdown('<p class="exam-header">📝 Exam Mode</p>', unsafe_allow_html=True)
st.markdown("Test your understanding with practice questions from your course materials!")

# ── Session Setup ───────────────────────────────────────────────────────────
if "quiz_session_id" not in st.session_state:
    st.session_state.quiz_session_id = create_session()

if "quiz_questions" not in st.session_state:
    st.session_state.quiz_questions = []

if "quiz_answers" not in st.session_state:
    st.session_state.quiz_answers = {}

if "quiz_submitted" not in st.session_state:
    st.session_state.quiz_submitted = False

if "quiz_score" not in st.session_state:
    st.session_state.quiz_score = 0

# ── Sidebar Options ─────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 📝 Exam Settings")
    quiz_topic = st.text_input("Topic", placeholder="Leave blank for all topics")
    quiz_difficulty = st.selectbox("Difficulty", ["All", "easy", "medium", "hard"])
    quiz_count = st.slider("Number of questions", 3, 10, 5)

    if quiz_difficulty == "All":
        quiz_difficulty = None

    if st.button("🎯 Start New Quiz", type="primary"):
        questions = get_accepted_questions(
            topic=quiz_topic if quiz_topic else None,
            difficulty=quiz_difficulty,
            limit=quiz_count,
        )
        if questions:
            st.session_state.quiz_questions = questions
            st.session_state.quiz_answers = {}
            st.session_state.quiz_submitted = False
            st.session_state.quiz_score = 0
            st.rerun()
        else:
            st.warning("⚠️ No approved questions available. Ask an admin to review pending questions first.")

# ── Quiz Display ────────────────────────────────────────────────────────────
if not st.session_state.quiz_questions:
    st.info("👈 Click **Start New Quiz** in the sidebar to begin! Make sure there are approved questions in the question bank.")
else:
    questions = st.session_state.quiz_questions

    for i, q in enumerate(questions):
        st.markdown(f"### Question {i + 1} of {len(questions)}")
        st.markdown(f"**{q['question']}**")

        if q.get("source_doc"):
            st.caption(f"📄 Source: {q['source_doc']}, Page {q.get('source_page', '?')}  |  Difficulty: {q.get('difficulty', 'medium').title()}")

        q_type = q.get("type", "mcq")

        if q_type == "mcq" and q.get("options"):
            options = q["options"]
            answer = st.radio(
                f"Select your answer for Q{i+1}:",
                options,
                key=f"q_{i}",
                disabled=st.session_state.quiz_submitted,
            )
            st.session_state.quiz_answers[i] = answer

        elif q_type == "true_false":
            answer = st.radio(
                f"Select your answer for Q{i+1}:",
                ["True", "False"],
                key=f"q_{i}",
                disabled=st.session_state.quiz_submitted,
            )
            st.session_state.quiz_answers[i] = answer

        else:  # short_answer
            answer = st.text_area(
                f"Your answer for Q{i+1}:",
                key=f"q_{i}",
                disabled=st.session_state.quiz_submitted,
            )
            st.session_state.quiz_answers[i] = answer

        # Show feedback after submission
        if st.session_state.quiz_submitted:
            correct = q["correct_answer"]
            user_ans = st.session_state.quiz_answers.get(i, "")

            if q_type == "mcq":
                is_correct = user_ans and user_ans.startswith(correct[0])
            elif q_type == "true_false":
                is_correct = user_ans.lower() == correct.lower()
            else:
                is_correct = None  # Can't auto-grade short answers

            if is_correct is True:
                st.success(f"✅ Correct! {q.get('explanation', '')}")
            elif is_correct is False:
                st.error(f"❌ Incorrect. The correct answer is: **{correct}**\n\n{q.get('explanation', '')}")
            else:
                st.info(f"📝 Model answer: **{correct}**\n\n{q.get('explanation', '')}")

        st.markdown("---")

    # Submit button
    if not st.session_state.quiz_submitted:
        if st.button("✅ Submit Answers", type="primary"):
            # Calculate score
            score = 0
            total = len(questions)

            for i, q in enumerate(questions):
                correct = q["correct_answer"]
                user_ans = st.session_state.quiz_answers.get(i, "")
                q_type = q.get("type", "mcq")

                if q_type == "mcq":
                    is_correct = user_ans and user_ans.startswith(correct[0])
                elif q_type == "true_false":
                    is_correct = user_ans.lower() == correct.lower()
                else:
                    is_correct = False  # Can't auto-grade

                if is_correct:
                    score += 1

                # Record attempt
                record_attempt(
                    st.session_state.quiz_session_id,
                    q.get("id", 0),
                    user_ans,
                    is_correct,
                )

            st.session_state.quiz_score = score
            st.session_state.quiz_submitted = True
            st.rerun()

    else:
        # Show final score
        score = st.session_state.quiz_score
        total = len(questions)
        pct = (score / total * 100) if total > 0 else 0

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Score", f"{score}/{total}")
        with col2:
            st.metric("Percentage", f"{pct:.0f}%")
        with col3:
            if pct >= 80:
                st.metric("Grade", "⭐ Excellent!")
            elif pct >= 60:
                st.metric("Grade", "👍 Good")
            else:
                st.metric("Grade", "📖 Keep Studying")
