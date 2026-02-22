"""
quiz_mode.py - Exam Mode with Question Generation and HITL Validation.

Handles:
- Generating practice questions from lecture material
- HITL validation pipeline (pending → accepted/rejected)
- Question bank management via SQLite

Author: Delvin (Feature Engineering)
"""
import os
import json
import random
import sqlite3
from datetime import datetime
from typing import Optional

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.documents import Document

from src.retriever import hybrid_retrieve
from src.citations import extract_citation_for_quiz
import config


# ── Database Setup ──────────────────────────────────────────────────────────

def _get_quiz_connection() -> sqlite3.Connection:
    """Get a SQLite connection for the quiz database."""
    os.makedirs(os.path.dirname(config.QUIZ_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(config.QUIZ_DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


def init_quiz_db():
    """Initialize the quiz database tables."""
    conn = _get_quiz_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            question TEXT NOT NULL,
            options TEXT,
            correct_answer TEXT NOT NULL,
            explanation TEXT NOT NULL,
            difficulty TEXT DEFAULT 'medium',
            source_doc TEXT,
            source_page INTEGER,
            topic TEXT,
            notebook_id TEXT,
            status TEXT DEFAULT 'pending',
            admin_notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            reviewed_at TEXT
        )
    """)

    # Migrate existing DB: add notebook_id column if it doesn't exist
    existing_cols = [row[1] for row in cursor.execute("PRAGMA table_info(questions)").fetchall()]
    if "notebook_id" not in existing_cols:
        cursor.execute("ALTER TABLE questions ADD COLUMN notebook_id TEXT")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            question_id INTEGER,
            user_answer TEXT,
            is_correct BOOLEAN,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (question_id) REFERENCES questions(id)
        )
    """)

    conn.commit()
    conn.close()


# ── Question Generation ─────────────────────────────────────────────────────

def generate_questions(
    topic: Optional[str] = None,
    num_questions: int = None,
    question_type: Optional[str] = None,
    filters: Optional[dict] = None,
    notebook_id: Optional[str] = None,
) -> list[dict]:
    """
    Generate practice questions from lecture materials.

    Args:
        topic: Optional topic to focus on.
        num_questions: Number of questions to generate.
        filters: Optional metadata filters for retrieval.

    Returns:
        List of question dicts.
    """
    if num_questions is None:
        num_questions = config.QUIZ_QUESTIONS_PER_BATCH

    # Retrieve relevant context
    search_query = topic if topic else "key concepts and important topics"
    chunks = hybrid_retrieve(search_query, k=8, filters=filters)

    if not chunks:
        return []

    # Build context from chunks
    context_text = "\n\n---\n\n".join([doc.page_content for doc in chunks])

    # Load the quiz generation prompt
    prompt_path = os.path.join(config.PROMPTS_DIR, "quiz_prompt.txt")
    with open(prompt_path, "r", encoding="utf-8") as f:
        prompt_template = f.read()

    type_instructions = {
        "mcq": "Generate ONLY Multiple Choice Questions (MCQ). Each must have exactly 4 options (A-D) with one correct answer.",
        "true_false": "Generate ONLY True/False questions. Each question must be a clear statement the student marks as True or False.",
        "open_ended": "Generate ONLY Open Ended / Short Answer questions. No options are needed — students write their own answer.",
    }
    question_type_instruction = type_instructions.get(
        question_type or "",
        "Create a MIX of question types: Multiple Choice (MCQ), Short Answer, and True/False."
    )

    prompt = prompt_template.format(
        num_questions=num_questions,
        context=context_text,
        topic=topic or "All topics from the provided context",
        question_type_instruction=question_type_instruction,
    )

    # Generate questions
    llm = ChatGoogleGenerativeAI(
        model=config.LLM_MODEL,
        temperature=0.5,  # Slightly higher temp for variety
        max_output_tokens=8192,
        google_api_key=config.GOOGLE_API_KEY,
    )

    response = llm.invoke(prompt)

    try:
        # Parse the JSON response
        content = response.content.strip()
        # Handle markdown code blocks
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        questions = json.loads(content)

        if isinstance(questions, list):
            labels = ["A", "B", "C", "D"]
            for q in questions:
                # Enforce source citation from retrieved context metadata (do not trust LLM-provided source_doc)
                citation = extract_citation_for_quiz(chunks[0].metadata)
                q["source_doc"] = citation["source_doc"]
                q["source_page"] = citation["source_page"]

                # Shuffle MCQ options so correct answer isn't always B/C
                if q.get("type") == "mcq" and isinstance(q.get("options"), list) and len(q["options"]) > 1:
                    # Strip existing letter prefix (e.g. "A) text" -> "text")
                    stripped = []
                    correct_letter = str(q.get("correct_answer", "")).strip().rstrip(")").strip()
                    correct_idx = None
                    for i, opt in enumerate(q["options"]):
                        # Option may look like "A) Some text" or just "Some text"
                        if len(opt) >= 2 and opt[0].isalpha() and opt[1] in ") .":
                            stripped.append(opt[2:].strip())
                        else:
                            stripped.append(opt.strip())
                        if labels[i] == correct_letter:
                            correct_idx = i

                    if correct_idx is not None:
                        # Shuffle the plain text options
                        paired = list(enumerate(stripped))
                        random.shuffle(paired)
                        new_options = [f"{labels[j]}) {text}" for j, (_, text) in enumerate(paired)]
                        # Find where the original correct option ended up
                        new_correct_pos = next(j for j, (orig_i, _) in enumerate(paired) if orig_i == correct_idx)
                        q["options"] = new_options
                        q["correct_answer"] = labels[new_correct_pos]

            # Attach notebook_id to each question so save_generated_questions can store it
            if notebook_id:
                for q in questions:
                    q["notebook_id"] = notebook_id
            return questions
    except (json.JSONDecodeError, AttributeError) as e:
        print(f"[ERR] Failed to parse quiz questions: {e}")
        print(f"[ERR] Raw LLM response (first 500 chars): {response.content[:500] if hasattr(response, 'content') else 'N/A'}")
        raise RuntimeError(f"Failed to parse LLM response as JSON: {e}")

    return []


def save_generated_questions(questions: list[dict]) -> int:
    """
    Save generated questions to the database with 'pending' status.

    Returns:
        Number of questions saved.
    """
    init_quiz_db()
    conn = _get_quiz_connection()
    now = datetime.now().isoformat()
    saved = 0

    for q in questions:
        try:
            conn.execute(
                """INSERT INTO questions 
                   (type, question, options, correct_answer, explanation, 
                    difficulty, source_doc, source_page, topic, notebook_id, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
                (
                    q.get("type", "mcq"),
                    q["question"],
                    json.dumps(q.get("options")) if q.get("options") else None,
                    q["correct_answer"],
                    q.get("explanation", ""),
                    q.get("difficulty", "medium"),
                    q.get("source_doc", ""),
                    q.get("source_page", 0),
                    q.get("topic", ""),
                    q.get("notebook_id"),
                    now,
                ),
            )
            saved += 1
        except Exception as e:
            print(f"[ERR] Error saving question: {e}")

    conn.commit()
    conn.close()
    return saved


def delete_question_by_id(question_id: int) -> bool:
    """Permanently delete a single question by ID."""
    init_quiz_db()
    conn = _get_quiz_connection()
    cur = conn.execute("DELETE FROM questions WHERE id = ?", (question_id,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def delete_questions_by_source(source_doc: str, notebook_id: Optional[str] = None) -> int:
    """Delete all questions whose source_doc matches the given filename, optionally scoped to a notebook."""
    init_quiz_db()
    conn = _get_quiz_connection()
    if notebook_id:
        cur = conn.execute(
            "DELETE FROM questions WHERE source_doc = ? AND notebook_id = ?",
            (source_doc, notebook_id),
        )
    else:
        cur = conn.execute("DELETE FROM questions WHERE source_doc = ?", (source_doc,))
    conn.commit()
    conn.close()
    return cur.rowcount


def get_pending_questions(notebook_id: Optional[str] = None) -> list[dict]:
    """Get all questions pending admin review, optionally scoped to a notebook."""
    init_quiz_db()
    conn = _get_quiz_connection()
    if notebook_id:
        rows = conn.execute(
            "SELECT * FROM questions WHERE status = 'pending' AND notebook_id = ? ORDER BY created_at DESC",
            (notebook_id,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM questions WHERE status = 'pending' ORDER BY created_at DESC"
        ).fetchall()
    conn.close()

    return [dict(row) for row in rows]


def review_question(question_id: int, action: str, admin_notes: str = "", edited_data: Optional[dict] = None):
    """
    Review a pending question: accept, reject, or edit.

    Args:
        question_id: ID of the question.
        action: 'accept', 'reject', or 'edit'.
        admin_notes: Optional notes from the admin.
        edited_data: If action is 'edit', dict with updated fields.
    """
    init_quiz_db()
    conn = _get_quiz_connection()
    now = datetime.now().isoformat()

    if action == "accept":
        conn.execute(
            "UPDATE questions SET status = 'accepted', admin_notes = ?, reviewed_at = ? WHERE id = ?",
            (admin_notes, now, question_id),
        )
    elif action == "reject":
        conn.execute(
            "UPDATE questions SET status = 'rejected', admin_notes = ?, reviewed_at = ? WHERE id = ?",
            (admin_notes, now, question_id),
        )
    elif action == "edit" and edited_data:
        # Update the question with edited data
        update_fields = []
        update_values = []
        for key in ["question", "correct_answer", "explanation", "difficulty"]:
            if key in edited_data:
                update_fields.append(f"{key} = ?")
                update_values.append(edited_data[key])
        if "options" in edited_data:
            update_fields.append("options = ?")
            update_values.append(json.dumps(edited_data["options"]))

        update_fields.extend(["status = ?", "admin_notes = ?", "reviewed_at = ?"])
        update_values.extend(["accepted", admin_notes, now])
        update_values.append(question_id)

        conn.execute(
            f"UPDATE questions SET {', '.join(update_fields)} WHERE id = ?",
            update_values,
        )

    conn.commit()
    conn.close()


# ── Question Bank Access ────────────────────────────────────────────────────

def get_accepted_questions(
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    limit: int = 10,
    notebook_id: Optional[str] = None,
) -> list[dict]:
    """Get accepted questions for student-facing Exam Mode."""
    init_quiz_db()
    conn = _get_quiz_connection()

    query = "SELECT * FROM questions WHERE status = 'accepted'"
    params = []

    if notebook_id:
        query += " AND notebook_id = ?"
        params.append(notebook_id)

    if topic:
        query += " AND topic = ?"
        params.append(topic)

    if difficulty:
        query += " AND difficulty = ?"
        params.append(difficulty)

    query += " ORDER BY RANDOM() LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()

    questions = []
    for row in rows:
        q = dict(row)
        # Parse options JSON
        if q.get("options"):
            try:
                q["options"] = json.loads(q["options"])
            except json.JSONDecodeError:
                q["options"] = None
        questions.append(q)

    return questions


def record_attempt(session_id: str, question_id: int, user_answer: str, is_correct: bool):
    """Record a student's quiz attempt."""
    init_quiz_db()
    conn = _get_quiz_connection()
    now = datetime.now().isoformat()

    conn.execute(
        "INSERT INTO quiz_attempts (session_id, question_id, user_answer, is_correct, timestamp) VALUES (?, ?, ?, ?, ?)",
        (session_id, question_id, user_answer, is_correct, now),
    )
    conn.commit()
    conn.close()


def get_quiz_stats(notebook_id: Optional[str] = None) -> dict:
    """Get overall quiz statistics for the admin dashboard, optionally scoped to a notebook."""
    init_quiz_db()
    conn = _get_quiz_connection()

    nb_filter = " AND notebook_id = ?" if notebook_id else ""
    nb_params = [notebook_id] if notebook_id else []

    total    = conn.execute(f"SELECT COUNT(*) as cnt FROM questions WHERE 1=1{nb_filter}", nb_params).fetchone()["cnt"]
    pending  = conn.execute(f"SELECT COUNT(*) as cnt FROM questions WHERE status = 'pending'{nb_filter}", nb_params).fetchone()["cnt"]
    accepted = conn.execute(f"SELECT COUNT(*) as cnt FROM questions WHERE status = 'accepted'{nb_filter}", nb_params).fetchone()["cnt"]
    rejected = conn.execute(f"SELECT COUNT(*) as cnt FROM questions WHERE status = 'rejected'{nb_filter}", nb_params).fetchone()["cnt"]

    # Attempt stats — join attempts → questions so we can filter by notebook
    if notebook_id:
        total_attempts   = conn.execute(
            "SELECT COUNT(*) as cnt FROM quiz_attempts qa JOIN questions q ON qa.question_id = q.id WHERE q.notebook_id = ?",
            [notebook_id]
        ).fetchone()["cnt"]
        correct_attempts = conn.execute(
            "SELECT COUNT(*) as cnt FROM quiz_attempts qa JOIN questions q ON qa.question_id = q.id WHERE q.notebook_id = ? AND qa.is_correct = 1",
            [notebook_id]
        ).fetchone()["cnt"]
    else:
        total_attempts   = conn.execute("SELECT COUNT(*) as cnt FROM quiz_attempts").fetchone()["cnt"]
        correct_attempts = conn.execute("SELECT COUNT(*) as cnt FROM quiz_attempts WHERE is_correct = 1").fetchone()["cnt"]

    conn.close()

    return {
        "total_questions": total,
        "pending": pending,
        "accepted": accepted,
        "rejected": rejected,
        "total_attempts": total_attempts,
        "correct_attempts": correct_attempts,
        "accuracy": (correct_attempts / total_attempts * 100) if total_attempts > 0 else 0,
    }


def get_performance_trend(days: int = 14, notebook_id: Optional[str] = None) -> list:
    """Return daily quiz accuracy trend for the last N days, optionally scoped to a notebook.

    Each entry: {"date": "Feb 20", "accuracy": 75.0, "attempts": 8, "correct": 6}
    Days with no attempts are included as zeros so the chart line is continuous.
    """
    from datetime import date, timedelta

    init_quiz_db()
    conn = _get_quiz_connection()

    # Build a full date range for the last `days` days
    today = date.today()
    date_range = [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]

    # Fetch raw counts grouped by day, optionally scoped to notebook via question join
    if notebook_id:
        rows = conn.execute(
            """
            SELECT
                substr(qa.timestamp, 1, 10) as day,
                COUNT(*) as attempts,
                SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) as correct
            FROM quiz_attempts qa
            JOIN questions q ON qa.question_id = q.id
            WHERE q.notebook_id = ? AND substr(qa.timestamp, 1, 10) >= ?
            GROUP BY day
            ORDER BY day
            """,
            (notebook_id, date_range[0]),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT
                substr(timestamp, 1, 10) as day,
                COUNT(*) as attempts,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
            FROM quiz_attempts
            WHERE substr(timestamp, 1, 10) >= ?
            GROUP BY day
            ORDER BY day
            """,
            (date_range[0],),
        ).fetchall()
    conn.close()

    daily_map = {row["day"]: {"attempts": row["attempts"], "correct": row["correct"]} for row in rows}

    result = []
    for iso_date in date_range:
        d = date.fromisoformat(iso_date)
        label = d.strftime("%b %d")
        data = daily_map.get(iso_date, {"attempts": 0, "correct": 0})
        attempts = data["attempts"]
        correct = data["correct"]
        accuracy = round(correct / attempts * 100, 1) if attempts > 0 else None
        result.append({"date": label, "accuracy": accuracy, "attempts": attempts, "correct": correct})

    return result
