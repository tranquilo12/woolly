import re
from typing import Dict, List, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from ..utils.openai_client import get_openai_client
from ..utils.models import Message, ChatInsight


_async_client = get_openai_client(async_client=True)


def _store_insight(
    db: Session,
    chat_id: UUID,
    insight_type: str,
    content: str,
    model_used: str,
    usage: Dict,
    skip_interactions: int = None,
) -> None:
    """Store AI-generated insight in the database."""
    try:
        insight = ChatInsight(
            chat_id=chat_id,
            insight_type=insight_type,
            content=content,
            model_used=model_used,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            skip_interactions=skip_interactions,
        )
        db.add(insight)
        db.commit()
    except Exception as e:
        db.rollback()
        # Log error but don't fail the main operation
        print(f"Warning: Failed to store insight: {e}")


def _sanitize_title(raw_title: str) -> str:
    """Sanitize and constrain a title to 2-3 words in Title Case."""
    text = raw_title.strip().strip("\"'").strip()
    # Remove trailing punctuation and collapse whitespace
    text = re.sub(r"[\n\r]+", " ", text)
    text = re.sub(r"\s+", " ", text)

    # Keep only word chars, spaces, hyphens, and apostrophes
    text = re.sub(r"[^\w\s\-']", "", text)

    # Constrain to 3 words at most
    words = text.split()
    if not words:
        return "New Chat"
    words = words[:3]

    # Title case the result
    return " ".join(w.capitalize() for w in words)


async def generate_title_from_first_user_message(
    db: Session, chat_id: UUID, model: str = "gpt-4o-mini"
) -> Dict:
    """
    Generate a concise 2-3 word title from the first user message of a chat.
    Returns a dict with keys: title, model, usage{prompt_tokens, completion_tokens, total_tokens}.
    """
    first_user_message: Message | None = (
        db.query(Message)
        .filter(Message.chat_id == chat_id, Message.role == "user")
        .order_by(Message.created_at.asc())
        .first()
    )

    if not first_user_message or not (first_user_message.content or "").strip():
        return {
            "chat_id": chat_id,
            "title": "New Chat",
            "model": model,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }

    system_prompt = (
        "You create very concise, descriptive titles (2-3 words) for chats. "
        "Respond with ONLY the title text, no punctuation or quotes."
    )
    user_prompt = (
        "First user message:\n\n"
        + first_user_message.content
        + "\n\nTitle (2-3 words):"
    )

    completion = await _async_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=16,
    )

    text = (completion.choices[0].message.content or "").strip()
    title = _sanitize_title(text)
    usage = completion.usage

    usage_dict = {
        "prompt_tokens": getattr(usage, "prompt_tokens", 0) or 0,
        "completion_tokens": getattr(usage, "completion_tokens", 0) or 0,
        "total_tokens": getattr(usage, "total_tokens", 0) or 0,
    }

    # Store the generated title insight
    _store_insight(db, chat_id, "title", title, model, usage_dict)

    return {
        "chat_id": chat_id,
        "title": title,
        "model": model,
        "usage": usage_dict,
    }


def _load_ordered_conversation(db: Session, chat_id: UUID) -> List[Tuple[str, str]]:
    """Return ordered (role, content) tuples for user+assistant messages."""
    rows: List[Message] = (
        db.query(Message)
        .filter(
            Message.chat_id == chat_id,
            Message.role.in_(["user", "assistant"]),
        )
        .order_by(Message.created_at.asc())
        .all()
    )
    return [(m.role or "", m.content or "") for m in rows]


def _format_conversation_as_text(pairs: List[Tuple[str, str]]) -> str:
    lines: List[str] = []
    for role, content in pairs:
        if not content:
            continue
        label = (
            "User" if role == "user" else ("Assistant" if role == "assistant" else role)
        )
        lines.append(f"{label}: {content}")
    return "\n".join(lines)


async def generate_full_summary(
    db: Session, chat_id: UUID, model: str = "gpt-4o-mini"
) -> Dict:
    """
    Summarize the entire conversation (user+assistant messages).
    Returns dict with keys: chat_id, summary, model, usage{...}.
    """
    convo = _load_ordered_conversation(db, chat_id)
    if not convo:
        return {
            "chat_id": chat_id,
            "summary": "",
            "model": model,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }

    system_prompt = (
        "You summarize conversations clearly and concisely for later recall. "
        "Include key decisions, requests, and action items when present."
    )
    user_prompt = (
        "Summarize the following conversation:\n\n"
        + _format_conversation_as_text(convo)
    )

    completion = await _async_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=512,
    )

    text = (completion.choices[0].message.content or "").strip()
    usage = completion.usage

    usage_dict = {
        "prompt_tokens": getattr(usage, "prompt_tokens", 0) or 0,
        "completion_tokens": getattr(usage, "completion_tokens", 0) or 0,
        "total_tokens": getattr(usage, "total_tokens", 0) or 0,
    }

    # Store the generated summary insight
    _store_insight(db, chat_id, "summary", text, model, usage_dict)

    return {
        "chat_id": chat_id,
        "summary": text,
        "model": model,
        "usage": usage_dict,
    }


def _group_interactions(convo: List[Tuple[str, str]]) -> List[List[Tuple[str, str]]]:
    """
    Group conversation into interactions: a user message followed by the next assistant message.
    Unpaired trailing user or assistant messages are included as their own interaction.
    """
    interactions: List[List[Tuple[str, str]]] = []
    buffer: List[Tuple[str, str]] = []
    waiting_for_assistant = False

    for role, content in convo:
        if role == "user":
            if buffer:
                interactions.append(buffer)
                buffer = []
            buffer.append((role, content))
            waiting_for_assistant = True
        elif role == "assistant":
            if not buffer:
                # Assistant without preceding user -> standalone interaction
                interactions.append([(role, content)])
                waiting_for_assistant = False
            else:
                buffer.append((role, content))
                interactions.append(buffer)
                buffer = []
                waiting_for_assistant = False
        else:
            # Unknown roles are appended to current buffer
            buffer.append((role, content))

    if buffer:
        interactions.append(buffer)

    return interactions


async def generate_rolling_summary(
    db: Session, chat_id: UUID, skip_interactions: int, model: str = "gpt-4o-mini"
) -> Dict:
    """
    Summarize the conversation while skipping the first N interactions (user+assistant pairs).
    If skip_interactions >= total interactions, summarize the entire conversation.
    Returns dict with keys: chat_id, summary, model, usage{...}.
    """
    convo = _load_ordered_conversation(db, chat_id)
    if not convo:
        return {
            "chat_id": chat_id,
            "summary": "",
            "model": model,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }

    interactions = _group_interactions(convo)
    total = len(interactions)
    start_index = skip_interactions if skip_interactions < total else 0

    # Flatten selected interactions back to a role-content list
    selected: List[Tuple[str, str]] = []
    for block in interactions[start_index:]:
        selected.extend(block)

    system_prompt = (
        "You provide rolling summaries of conversations, focusing on the latest context. "
        "Capture important facts, decisions, and pending follow-ups."
    )
    user_prompt = (
        "Summarize the following conversation segment:\n\n"
        + _format_conversation_as_text(selected)
    )

    completion = await _async_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=512,
    )

    text = (completion.choices[0].message.content or "").strip()
    usage = completion.usage

    usage_dict = {
        "prompt_tokens": getattr(usage, "prompt_tokens", 0) or 0,
        "completion_tokens": getattr(usage, "completion_tokens", 0) or 0,
        "total_tokens": getattr(usage, "total_tokens", 0) or 0,
    }

    # Store the generated rolling summary insight
    _store_insight(
        db, chat_id, "rolling_summary", text, model, usage_dict, skip_interactions
    )

    return {
        "chat_id": chat_id,
        "summary": text,
        "model": model,
        "usage": usage_dict,
    }
