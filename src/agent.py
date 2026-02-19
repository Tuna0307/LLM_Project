"""
agent.py - Agent Router and Self-Reflection Loop.

Implements:
- Routing agent: decides RAG vs Direct LLM vs Web Search vs Quiz
- Self-reflection loop: Plan → Act → Observe → Reflect → Revise
- Main query pipeline that orchestrates everything

Author: Shunren (Core RAG Logic)
"""
import json
import os
from typing import Optional

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.documents import Document

from src.retriever import hybrid_retrieve, rebuild_bm25_index
from src.citations import format_citations_block
from src.memory import (
    get_messages,
    format_chat_history,
    get_relevant_history,
    add_message,
    get_message_count,
    summarize_session,
)
import config


def _load_prompt(filename: str) -> str:
    """Load a prompt template from the prompts directory."""
    filepath = os.path.join(config.PROMPTS_DIR, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def _get_llm(temperature: Optional[float] = None) -> ChatGoogleGenerativeAI:
    """Get a ChatGoogleGenerativeAI instance."""
    return ChatGoogleGenerativeAI(
        model=config.LLM_MODEL,
        temperature=temperature if temperature is not None else config.LLM_TEMPERATURE,
        max_output_tokens=config.LLM_MAX_TOKENS,
        google_api_key=config.GOOGLE_API_KEY,
    )


# ── Agent Routing ───────────────────────────────────────────────────────────

def route_query(query: str) -> dict:
    """
    Decide how to handle a query: RAG, direct LLM, web search, or quiz.

    Returns:
        Dict with 'route' and 'reasoning' keys.
    """
    llm = _get_llm(temperature=0.0)
    prompt_template = _load_prompt("routing_prompt.txt")
    prompt = prompt_template.format(query=query)

    response = llm.invoke(prompt)

    try:
        result = json.loads(response.content)
        if isinstance(result, dict) and "route" in result:
            return result
    except (json.JSONDecodeError, AttributeError):
        pass

    # Default to RAG for safety
    return {"route": "rag", "reasoning": "Defaulting to RAG retrieval"}


# ── Self-Reflection ─────────────────────────────────────────────────────────

def reflect_on_answer(
    query: str,
    answer: str,
    chunks: list[Document],
) -> dict:
    """
    Evaluate the quality of a generated answer.

    Returns:
        Dict with confidence scores and retry suggestion.
    """
    llm = _get_llm(temperature=0.0)
    prompt_template = _load_prompt("reflection_prompt.txt")

    chunks_text = "\n---\n".join([doc.page_content for doc in chunks[:5]])
    prompt = prompt_template.format(chunks=chunks_text, answer=answer)

    response = llm.invoke(prompt)

    try:
        result = json.loads(response.content)
        return result
    except (json.JSONDecodeError, AttributeError):
        return {
            "overall_confidence": 0.5,
            "should_retry": False,
            "retry_suggestion": "",
        }


# ── Web Search Tool ─────────────────────────────────────────────────────────

def web_search(query: str) -> str:
    """Perform a web search and return top results as context."""
    try:
        from duckduckgo_search import DDGS

        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))

        if not results:
            return "No web results found."

        context = "🌐 **Web Search Results:**\n\n"
        for r in results:
            context += f"**{r.get('title', 'N/A')}**\n{r.get('body', '')}\n\n"

        return context

    except Exception as e:
        return f"Web search unavailable: {e}"


# ── RAG Pipeline ────────────────────────────────────────────────────────────

def rag_answer(
    query: str,
    session_id: Optional[str] = None,
    filters: Optional[dict] = None,
    multi_hop: bool = False,
) -> dict:
    """
    Full RAG pipeline with self-reflection.

    Pipeline:
    1. Retrieve relevant chunks (hybrid)
    2. Generate answer with context
    3. Reflect on answer quality
    4. Retry if confidence is low (up to MAX_REFLECTION_ITERATIONS)

    Returns:
        Dict with 'answer', 'citations', 'confidence', 'chunks_used', 'iterations'.
    """
    llm = _get_llm()
    system_prompt_template = _load_prompt("system_prompt.txt")

    # Get conversation history
    history_text = ""
    if session_id:
        messages = get_messages(session_id)
        history_text = format_chat_history(messages)

        # Also check for relevant past sessions
        past_context = get_relevant_history(query)
        if past_context:
            history_text = past_context + "\n\n" + history_text

    best_answer = ""
    best_confidence = 0.0
    best_chunks = []
    iterations = 0

    current_query = query

    for iteration in range(config.MAX_REFLECTION_ITERATIONS + 1):
        iterations = iteration + 1

        # Step 1: Retrieve
        chunks = hybrid_retrieve(
            current_query,
            filters=filters,
            multi_hop=multi_hop,
        )

        if not chunks:
            return {
                "answer": "I couldn't find relevant information in the uploaded course materials. "
                          "Please check if the relevant notes have been uploaded.",
                "citations": "",
                "confidence": 0.0,
                "chunks_used": 0,
                "iterations": iterations,
            }

        # Step 2: Generate answer
        context_text = "\n\n---\n\n".join([doc.page_content for doc in chunks])
        system_prompt = system_prompt_template.format(
            context=context_text,
            history=history_text,
            question=query,
        )

        response = llm.invoke(system_prompt)
        answer = response.content

        # Step 3: Reflect
        if iteration < config.MAX_REFLECTION_ITERATIONS:
            reflection = reflect_on_answer(query, answer, chunks)
            confidence = reflection.get("overall_confidence", 0.5)

            if confidence >= config.CONFIDENCE_THRESHOLD:
                # Good enough, return this answer
                return {
                    "answer": answer,
                    "citations": format_citations_block(chunks),
                    "confidence": confidence,
                    "chunks_used": len(chunks),
                    "iterations": iterations,
                }

            # Not confident enough, try to improve
            if reflection.get("should_retry") and reflection.get("retry_suggestion"):
                current_query = reflection["retry_suggestion"]

            # Track best so far
            if confidence > best_confidence:
                best_answer = answer
                best_confidence = confidence
                best_chunks = chunks
        else:
            # Last iteration, use this answer
            best_answer = answer
            best_chunks = chunks

    # Return best answer found
    return {
        "answer": best_answer,
        "citations": format_citations_block(best_chunks),
        "confidence": best_confidence,
        "chunks_used": len(best_chunks),
        "iterations": iterations,
    }


# ── Direct LLM Answer ──────────────────────────────────────────────────────

def direct_answer(query: str) -> dict:
    """Answer a general question directly without RAG retrieval."""
    llm = _get_llm()

    prompt = f"""You are IRRA, a helpful study assistant. The following question
is a general knowledge question that doesn't require course-specific materials.
Answer clearly and concisely.

Question: {query}"""

    response = llm.invoke(prompt)

    return {
        "answer": response.content,
        "citations": "\n\n💡 *This answer was generated from general knowledge, not course materials.*",
        "confidence": 0.8,
        "chunks_used": 0,
        "iterations": 1,
    }


# ── Main Query Handler ─────────────────────────────────────────────────────

def handle_query(
    query: str,
    session_id: Optional[str] = None,
    filters: Optional[dict] = None,
) -> dict:
    """
    Main entry point: route the query and execute the appropriate pipeline.

    Args:
        query: User's question.
        session_id: Current session ID for memory.
        filters: Optional metadata filters.

    Returns:
        Dict with 'answer', 'citations', 'route', 'confidence', etc.
    """
    # Step 1: Route the query
    routing = route_query(query)
    route = routing.get("route", "rag")

    # Step 2: Execute based on route
    if route == "rag":
        # Detect if multi-hop is needed (complex or synthesis question)
        multi_hop = any(
            keyword in query.lower()
            for keyword in ["relate", "connect", "compare", "link", "difference between", "how does"]
        )
        result = rag_answer(query, session_id, filters, multi_hop=multi_hop)

    elif route == "direct":
        result = direct_answer(query)

    elif route == "web":
        web_context = web_search(query)
        llm = _get_llm()
        response = llm.invoke(
            f"Using the following web search results, answer the student's question.\n\n"
            f"Web Results:\n{web_context}\n\nQuestion: {query}"
        )
        result = {
            "answer": response.content,
            "citations": "\n\n🌐 *This answer includes information from web search.*",
            "confidence": 0.7,
            "chunks_used": 0,
            "iterations": 1,
        }

    elif route == "quiz":
        # This will be handled by quiz_mode.py via the frontend
        result = {
            "answer": "🎯 **Switching to Exam Mode!**\n\nI'll generate practice questions for you. "
                      "Please use the **Exam Mode** page in the sidebar for the full quiz experience.",
            "citations": "",
            "confidence": 1.0,
            "chunks_used": 0,
            "iterations": 1,
        }

    else:
        result = rag_answer(query, session_id, filters)

    # Add routing info
    result["route"] = route
    result["routing_reasoning"] = routing.get("reasoning", "")

    # Save to memory
    if session_id:
        add_message(session_id, "user", query)
        add_message(session_id, "assistant", result["answer"])

        # Periodically summarize
        msg_count = get_message_count(session_id)
        if msg_count > 0 and msg_count % (config.SUMMARY_INTERVAL * 2) == 0:
            summarize_session(session_id)

    return result
