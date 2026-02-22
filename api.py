import config
import os
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tempfile

# Import existing logic
from src.agent import handle_query
from src.memory import create_session, get_all_sessions, get_session_messages_full, delete_session
from src.ingest import load_and_process_file, SUPPORTED_EXTENSIONS
from src.vectorstore import add_documents, get_collection_stats, get_document_metadata_values, get_uploaded_documents, delete_documents_by_source
from src.retriever import rebuild_bm25_index
from src.quiz_mode import (
    generate_questions,
    save_generated_questions,
    get_pending_questions,
    review_question,
    get_quiz_stats,
    get_accepted_questions,
    record_attempt,
    get_performance_trend,
    delete_question_by_id,
    delete_questions_by_source as delete_quiz_questions_by_source,
)

app = FastAPI(title="IRRA API", description="Intelligent RAG Revision Assistant API")

# Allow CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---

class ChatRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    answer: str
    citations: str
    route: str
    confidence: float
    session_id: str

class GenerateQuizRequest(BaseModel):
    topic: Optional[str] = None
    num_questions: int = 5
    question_type: Optional[str] = None  # "mcq", "true_false", "open_ended", or None for mixed

class ReviewQuizRequest(BaseModel):
    action: str # "accept", "reject", "edit"
    admin_notes: Optional[str] = None
    edited_data: Optional[Dict[str, Any]] = None

class RecordAttemptRequest(BaseModel):
    session_id: str
    question_id: int
    user_answer: str
    is_correct: bool

# --- Endpoints ---

@app.get("/")
def read_root():
    return {"status": "IRRA API is running"}

# 1. Chat Endpoints
@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    session_id = request.session_id or create_session()
    
    try:
        result = handle_query(
            query=request.query,
            session_id=session_id,
            filters=request.filters
        )
        
        return ChatResponse(
            answer=result.get("answer", ""),
            citations=result.get("citations", ""),
            route=result.get("route", "rag"),
            confidence=result.get("confidence", 0.0),
            session_id=session_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 1b. Session History Endpoints
@app.get("/api/sessions")
def api_list_sessions():
    """Return all chat sessions with preview, ordered by most recent."""
    try:
        return get_all_sessions()
    except Exception as e:
        return []

@app.get("/api/sessions/{session_id}/messages")
def api_get_session_messages(session_id: str):
    """Return all messages for a given session."""
    messages = get_session_messages_full(session_id)
    if not messages:
        raise HTTPException(status_code=404, detail="Session not found or empty")
    return messages

@app.delete("/api/sessions/{session_id}")
def api_delete_session(session_id: str):
    """Permanently delete a session and all its messages."""
    delete_session(session_id)
    return {"status": "deleted"}

# 2. Upload Endpoints
@app.post("/api/upload")
async def upload_notes(
    files: List[UploadFile] = File(...),
    topic: Optional[str] = Form(None),
    week: Optional[int] = Form(0),
    doc_type: Optional[str] = Form("lecture")
):
    extra_metadata = {"doc_type": doc_type}
    if topic:
        extra_metadata["topic"] = topic
    if week and week > 0:
        extra_metadata["week"] = week

    all_chunks = []

    for file in files:
        # Preserve the original file extension so the loader can detect the format
        original_ext = os.path.splitext(file.filename or "")[1].lower() or ".tmp"
        if original_ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{original_ext}' for '{file.filename}'. "
                       f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )

        with tempfile.NamedTemporaryFile(delete=False, suffix=original_ext) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        try:
            # Delete any existing chunks for this file so re-uploads don't duplicate
            deleted = delete_documents_by_source(file.filename)
            if deleted:
                print(f"[REPLACE] Replaced {deleted} existing chunks for '{file.filename}'")
            chunks = load_and_process_file(tmp_path, extra_metadata, original_filename=file.filename)
            all_chunks.extend(chunks)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing {file.filename}: {str(e)}")
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    if all_chunks:
        added = add_documents(all_chunks)
        rebuild_bm25_index()
        return {"message": f"Successfully indexed {added} chunks from {len(files)} files."}
    else:
        return {"message": "No chunks were extracted."}

# 3. Quiz Endpoints
@app.post("/api/quiz/generate")
def api_generate_questions(request: GenerateQuizRequest):
    try:
        questions = generate_questions(
            topic=request.topic,
            num_questions=request.num_questions,
            question_type=request.question_type
        )
        if questions:
            saved = save_generated_questions(questions)
            return {"message": f"Generated and saved {saved} questions.", "count": saved}
        raise HTTPException(status_code=400, detail="Could not generate questions. No chunks retrieved from vectorstore — make sure you have uploaded and indexed documents first.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation error: {str(e)}")

@app.get("/api/quiz/pending")
def api_get_pending_questions():
    return get_pending_questions()

@app.get("/api/quiz/accepted")
def api_get_accepted_questions(topic: Optional[str] = None, difficulty: Optional[str] = None, limit: int = 10):
    return get_accepted_questions(topic=topic, difficulty=difficulty, limit=limit)

@app.post("/api/quiz/{question_id}/review")
def api_review_question(question_id: int, request: ReviewQuizRequest):
    try:
        review_question(
            question_id=question_id,
            action=request.action,
            admin_notes=request.admin_notes,
            edited_data=request.edited_data
        )
        return {"message": f"Question {question_id} reviewed successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quiz/performance")
def api_get_performance_trend(days: int = 14):
    """Return daily quiz accuracy trend for the last N days."""
    try:
        return get_performance_trend(days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/quiz/attempt")
def api_record_attempt(request: RecordAttemptRequest):
    try:
        record_attempt(
            session_id=request.session_id,
            question_id=request.question_id,
            user_answer=request.user_answer,
            is_correct=request.is_correct
        )
        return {"message": "Attempt recorded."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents/{filename:path}")
def api_delete_document(filename: str):
    """Delete all indexed chunks for a given source file, and its related questions."""
    try:
        deleted_chunks = delete_documents_by_source(filename)
        deleted_questions = delete_quiz_questions_by_source(filename)
        rebuild_bm25_index()
        return {
            "message": f"Deleted {deleted_chunks} chunks and {deleted_questions} questions for '{filename}'.",
            "deleted_chunks": deleted_chunks,
            "deleted_questions": deleted_questions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. Metadata Endpoint
@app.get("/api/documents/metadata")
def api_get_document_metadata():
    """Return unique weeks and topics from all indexed documents (for dynamic filter dropdowns)."""
    try:
        return get_document_metadata_values()
    except Exception as e:
        return {"weeks": [], "topics": []}

@app.get("/api/documents")
def api_get_uploaded_documents():
    """Return a list of all uploaded/indexed source files with metadata."""
    try:
        return get_uploaded_documents()
    except Exception as e:
        return []

# 5. Stats Endpoints
@app.delete("/api/questions/{question_id}")
def api_delete_question(question_id: int):
    """Permanently delete a question from the question bank."""
    try:
        deleted = delete_question_by_id(question_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Question not found.")
        return {"message": f"Question {question_id} deleted."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
def api_get_stats():
    try:
        vec_stats = get_collection_stats()
        quiz_stats = get_quiz_stats()
        return {
            "vectorstore": vec_stats,
            "quiz": quiz_stats
        }
    except Exception as e:
        return {
            "vectorstore": {"count": 0},
            "quiz": {"total_questions": 0, "pending": 0, "accepted": 0, "rejected": 0, "accuracy": 0}
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
