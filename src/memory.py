"""
memory.py - Long-term conversation memory using SQLite.

Handles:
- Storing conversation messages per session
- Summarizing conversations for long-term recall
- Retrieving relevant past context when user references prior discussions

Author: Group 12
"""
import os
import json
import sqlite3
import uuid
from datetime import datetime
from typing import Optional
from langchain_google_genai import ChatGoogleGenerativeAI

import config


def _get_connection() -> sqlite3.Connection:
    """Get a SQLite connection, creating the DB if needed."""
    os.makedirs(os.path.dirname(config.MEMORY_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(config.MEMORY_DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


def init_memory_db():
    """Initialize the memory database tables."""
    conn = _get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            summary TEXT DEFAULT '',
            notebook_id TEXT
        )
    """)

    # Migrate existing DB: add notebook_id column if it doesn't exist
    existing_cols = [row[1] for row in cursor.execute("PRAGMA table_info(sessions)").fetchall()]
    if "notebook_id" not in existing_cols:
        cursor.execute("ALTER TABLE sessions ADD COLUMN notebook_id TEXT")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id)
        )
    """)

    conn.commit()
    conn.close()


def create_session(notebook_id: Optional[str] = None) -> str:
    """Create a new conversation session and return its ID."""
    init_memory_db()
    session_id = str(uuid.uuid4())
    now = datetime.now().isoformat()

    conn = _get_connection()
    conn.execute(
        "INSERT INTO sessions (session_id, created_at, updated_at, notebook_id) VALUES (?, ?, ?, ?)",
        (session_id, now, now, notebook_id),
    )
    conn.commit()
    conn.close()

    return session_id


def add_message(session_id: str, role: str, content: str):
    """
    Add a message to the conversation history.

    Args:
        session_id: Current session ID.
        role: 'user' or 'assistant'.
        content: Message text.
    """
    init_memory_db()
    now = datetime.now().isoformat()

    conn = _get_connection()
    conn.execute(
        "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
        (session_id, role, content, now),
    )
    conn.execute(
        "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
        (now, session_id),
    )
    conn.commit()
    conn.close()


def get_messages(session_id: str, limit: int = 20) -> list[dict]:
    """
    Get recent messages from a session.

    Returns:
        List of message dicts with role and content.
    """
    init_memory_db()
    conn = _get_connection()
    rows = conn.execute(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
        (session_id, limit),
    ).fetchall()
    conn.close()

    # Return in chronological order
    return [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]


def get_message_count(session_id: str) -> int:
    """Get the number of messages in a session."""
    init_memory_db()
    conn = _get_connection()
    count = conn.execute(
        "SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?",
        (session_id,),
    ).fetchone()["cnt"]
    conn.close()
    return count


def summarize_session(session_id: str) -> str:
    """
    Generate a summary of the session using the LLM.
    Called periodically to keep long-term memory manageable.
    """
    messages = get_messages(session_id, limit=50)
    if not messages:
        return ""

    conversation_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in messages
    )

    llm = ChatGoogleGenerativeAI(
        model=config.LLM_MODEL,
        temperature=0.0,
        google_api_key=config.GOOGLE_API_KEY,
    )

    prompt = f"""Summarize the following study conversation in 2-3 sentences.
Focus on: what topics were discussed, what questions were asked, and any key points covered.

Conversation:
{conversation_text}

Summary:"""

    response = llm.invoke(prompt)
    summary = response.content.strip()

    # Store the summary
    conn = _get_connection()
    conn.execute(
        "UPDATE sessions SET summary = ? WHERE session_id = ?",
        (summary, session_id),
    )
    conn.commit()
    conn.close()

    return summary


def get_relevant_history(
    query: str,
    max_sessions: int = 3,
    notebook_id: Optional[str] = None,
) -> str:
    """
    Retrieve relevant past conversation summaries.
    Useful when user asks "What did we discuss yesterday?" or references past topics.

    Args:
        query: The current question to match against.
        max_sessions: Max number of past sessions to include.

    Returns:
        Formatted string of relevant past conversation summaries.
    """
    init_memory_db()
    conn = _get_connection()
    if notebook_id:
        rows = conn.execute(
            """
            SELECT session_id, summary, updated_at
            FROM sessions
            WHERE summary != '' AND notebook_id = ?
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (notebook_id, max_sessions),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT session_id, summary, updated_at FROM sessions WHERE summary != '' ORDER BY updated_at DESC LIMIT ?",
            (max_sessions,),
        ).fetchall()
    conn.close()

    if not rows:
        return ""

    history = "📝 **Relevant Past Conversations:**\n"
    for row in rows:
        date = row["updated_at"][:10]
        history += f"- [{date}] {row['summary']}\n"

    return history


def format_chat_history(messages: list[dict], max_turns: int = 5) -> str:
    """Format recent messages for inclusion in the LLM prompt."""
    recent = messages[-max_turns * 2 :] if len(messages) > max_turns * 2 else messages

    formatted = ""
    for msg in recent:
        role = "Student" if msg["role"] == "user" else "IRRA"
        formatted += f"{role}: {msg['content']}\n\n"

    return formatted.strip()


def get_all_sessions(limit: int = 30, notebook_id: Optional[str] = None) -> list[dict]:
    """
    Return all sessions that have at least one message, ordered by most recent.
    Includes message count and the first user message as a preview.
    If notebook_id is provided, only returns sessions for that notebook.
    """
    init_memory_db()
    conn = _get_connection()
    nb_filter = " AND s.notebook_id = ?" if notebook_id else ""
    nb_params = [notebook_id, limit] if notebook_id else [limit]
    rows = conn.execute(
        f"""
        SELECT s.session_id, s.created_at, s.updated_at, s.summary,
               COUNT(m.id) as message_count
        FROM sessions s
        LEFT JOIN messages m ON s.session_id = m.session_id
        WHERE 1=1{nb_filter}
        GROUP BY s.session_id
        HAVING message_count > 0
        ORDER BY s.updated_at DESC
        LIMIT ?
        """,
        nb_params,
    ).fetchall()

    sessions = []
    for row in rows:
        # Get first user message as a preview title
        first_user = conn.execute(
            "SELECT content FROM messages WHERE session_id = ? AND role = 'user' ORDER BY id ASC LIMIT 1",
            (row["session_id"],),
        ).fetchone()
        preview = first_user["content"] if first_user else "(no messages)"
        sessions.append({
            "session_id": row["session_id"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "summary": row["summary"] or "",
            "message_count": row["message_count"],
            "preview": preview,
        })

    conn.close()
    return sessions


def get_session_messages_full(session_id: str) -> list[dict]:
    """Get all messages for a session with timestamps, in chronological order."""
    init_memory_db()
    conn = _get_connection()
    rows = conn.execute(
        "SELECT role, content, timestamp FROM messages WHERE session_id = ? ORDER BY id ASC",
        (session_id,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def delete_session(session_id: str):
    """Permanently delete a session and all its messages."""
    init_memory_db()
    conn = _get_connection()
    conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()
