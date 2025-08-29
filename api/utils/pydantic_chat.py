"""
Pydantic AI-powered chat with MCP integration and AI SDK V5 streaming

This module provides chat functionality using the Universal Agent Factory
with full MCP tool access while maintaining the same AI SDK V5 streaming
format as the existing OpenAI chat system.
"""

import logging
import json
import uuid
from typing import List, AsyncGenerator, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session

from ..agents.universal import get_universal_factory, AgentType, UniversalDependencies
from ..utils.models import (
    build_end_of_stream_message,
    build_text_stream,
    build_message_start,
    build_message_end,
)
from .mcp_status import get_mcp_status_service

logger = logging.getLogger(__name__)


async def stream_pydantic_chat(
    messages: List[Dict[str, Any]],
    model: str = "gpt-4o",
    repository_name: str = "woolly",
    chat_id: Optional[UUID] = None,
    db: Optional[Session] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream chat responses using Pydantic AI with MCP integration

    This function provides the same AI SDK V5 streaming format as the existing
    OpenAI chat system but with full MCP tool access for code-aware conversations.

    Args:
        messages: List of chat messages from the frontend
        model: AI model to use (defaults to gpt-4o)
        repository_name: Repository name for MCP context
        chat_id: Optional chat ID for context
        db: Optional database session

    Yields:
        AI SDK V5 formatted streaming chunks
    """
    # Generate unique assistant message ID for this response
    assistant_message_id = str(uuid.uuid4())
    content_accumulator = ""

    # Always start with proper AI SDK V5 message start frame
    yield build_message_start(assistant_message_id, "assistant")

    try:
        # Check MCP status before proceeding
        mcp_service = get_mcp_status_service()
        mcp_status = mcp_service.get_status()

        # Get universal factory (already has MCP integration)
        factory = get_universal_factory()

        # Extract user query from messages
        user_messages = [msg for msg in messages if msg.get("role") == "user"]
        if not user_messages:
            error_text = "No user message found."
            yield build_text_stream(error_text)
            content_accumulator += error_text
        else:
            latest_query = user_messages[-1].get("content", "")

            # Inform user about MCP status if relevant
            if not mcp_status.available and should_use_mcp_tools(messages):
                status_text = (
                    f"🔧 **MCP Status**: {mcp_status.status.value.title()} - "
                    f"Code analysis tools are currently unavailable. "
                    f"Providing general assistance without repository context.\n\n"
                )
                yield build_text_stream(status_text)
                content_accumulator += status_text

            # Build conversation history for context
            conversation_history = []
            for msg in messages[:-1]:  # All except latest
                conversation_history.append(
                    {
                        "role": msg.get("role", ""),
                        "content": msg.get("content", ""),
                        "id": msg.get("id", None),
                        "timestamp": msg.get("created_at", None),
                    }
                )

            # Create dependencies with chat context
            deps = UniversalDependencies(
                repository_name=repository_name,
                agent_type=AgentType.CHAT_ASSISTANT,
                user_query=latest_query,
                context={
                    "chat_id": str(chat_id) if chat_id else None,
                    "conversation_history": conversation_history,
                    "model": model,
                    "chat_mode": True,  # Flag for chat-specific behavior
                    "message_count": len(messages),
                    "has_code_context": any(
                        keyword in latest_query.lower()
                        for keyword in [
                            "code",
                            "function",
                            "class",
                            "file",
                            "api",
                            "implementation",
                        ]
                    ),
                },
            )

            # Stream using existing Universal Agent Factory
            # This automatically handles MCP tools and V5 formatting
            logger.info(
                f"Starting Pydantic AI chat stream for query: {latest_query[:50]}..."
            )

            # Process factory streaming chunks and accumulate text content
            async for chunk in factory.execute_agent_streaming(
                agent_type=AgentType.CHAT_ASSISTANT,
                repository_name=repository_name,
                user_query=latest_query,
                context=deps.context,
            ):
                # Forward the chunk as-is (maintains tool calls, etc.)
                yield chunk

                # Extract text content for accumulation (for message end frame)
                if chunk.startswith("0:"):
                    try:
                        text_data = json.loads(chunk[2:])
                        if text_data.get("type") == "text":
                            # Extract delta content (our new format)
                            content_accumulator += text_data.get(
                                "delta", text_data.get("text", "")
                            )
                    except (json.JSONDecodeError, KeyError):
                        # If we can't parse, skip accumulation for this chunk
                        pass

    except Exception as e:
        logger.error(f"Pydantic AI chat error: {e}", exc_info=True)
        error_text = f"\n❌ Chat error: {str(e)}\n"
        yield build_text_stream(error_text)
        content_accumulator += error_text

    finally:
        # Always end with proper AI SDK V5 message end and stream end frames
        yield build_message_end(assistant_message_id, "assistant", content_accumulator)

        # Calculate rough token estimates
        prompt_tokens = sum(len(msg.get("content", "").split()) for msg in messages)
        completion_tokens = (
            len(content_accumulator.split()) if content_accumulator else 0
        )

        yield build_end_of_stream_message(
            finish_reason="stop",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            is_continued=False,
        )

        # Save the accumulated content to database after streaming completes
        if db and chat_id and content_accumulator:
            try:
                from ..utils.models import Message

                # Find the assistant message placeholder created in the main endpoint
                assistant_message = (
                    db.query(Message)
                    .filter(
                        Message.chat_id == chat_id,
                        Message.role == "assistant",
                        Message.content == "",  # Empty placeholder
                    )
                    .order_by(Message.created_at.desc())
                    .first()
                )

                if assistant_message:
                    # Update the placeholder with the actual content
                    assistant_message.content = content_accumulator
                    assistant_message.prompt_tokens = prompt_tokens
                    assistant_message.completion_tokens = completion_tokens
                    assistant_message.total_tokens = prompt_tokens + completion_tokens
                    db.commit()
                    logger.info(
                        f"Saved assistant message content to database: {len(content_accumulator)} chars"
                    )
                else:
                    logger.warning(
                        "Could not find assistant message placeholder to update"
                    )

            except Exception as save_error:
                logger.error(
                    f"Failed to save message content to database: {save_error}"
                )
                db.rollback()


def convert_messages_to_pydantic_context(
    messages: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Convert chat messages to Pydantic AI context format

    This function extracts useful context from the chat messages
    that can be used by the Pydantic AI agent for better responses.

    Args:
        messages: List of chat messages

    Returns:
        Dictionary with structured context information
    """
    return {
        "messages": [
            {
                "role": msg.get("role", ""),
                "content": msg.get("content", ""),
                "id": msg.get("id", None),
                "model": msg.get("model", None),
                "created_at": msg.get("created_at", None),
                "tool_invocations": msg.get("toolInvocations", None),
            }
            for msg in messages
        ],
        "message_count": len(messages),
        "user_message_count": len(
            [msg for msg in messages if msg.get("role") == "user"]
        ),
        "assistant_message_count": len(
            [msg for msg in messages if msg.get("role") == "assistant"]
        ),
        "has_attachments": any(
            msg.get("experimental_attachments", None) for msg in messages
        ),
        "latest_user_message": next(
            (
                msg.get("content")
                for msg in reversed(messages)
                if msg.get("role") == "user"
            ),
            None,
        ),
        "conversation_length": sum(len(msg.get("content", "")) for msg in messages),
    }


def should_use_mcp_tools(messages: List[Dict[str, Any]]) -> bool:
    """
    Determine if the conversation would benefit from MCP tools

    This function analyzes the messages to determine if MCP tools
    would be helpful for providing better responses.

    Args:
        messages: List of chat messages

    Returns:
        True if MCP tools would be beneficial
    """
    if not messages:
        return False

    # Get the latest user message
    user_messages = [msg for msg in messages if msg.get("role") == "user"]
    if not user_messages:
        return False

    latest_message = user_messages[-1].get("content", "").lower()

    # Keywords that suggest MCP tools would be helpful
    mcp_keywords = [
        # Code-related terms
        "code",
        "function",
        "class",
        "file",
        "repository",
        "repo",
        "implementation",
        "module",
        "component",
        "service",
        # Query-related terms
        "how does",
        "where is",
        "find",
        "search",
        "show me",
        "what is",
        "explain",
        "describe",
        "analyze",
        # Technical terms
        "api",
        "endpoint",
        "database",
        "model",
        "schema",
        "architecture",
        "structure",
        "pattern",
        "design",
        # Development terms
        "bug",
        "error",
        "issue",
        "problem",
        "fix",
        "debug",
        "test",
        "testing",
        "coverage",
        "unit test",
        "documentation",
        "docs",
        "readme",
        "guide",
        # Specific to this codebase
        "woolly",
        "agent",
        "mcp",
        "chat",
        "streaming",
        "fastapi",
        "pydantic",
        "universal",
        "triage",
    ]

    # Check if any keywords are present
    keyword_match = any(keyword in latest_message for keyword in mcp_keywords)

    # Also check for question patterns that suggest code exploration
    question_patterns = [
        "how do",
        "how does",
        "how can",
        "how to",
        "what is",
        "what are",
        "what does",
        "where is",
        "where are",
        "where can",
        "why does",
        "why is",
        "why are",
        "when does",
        "when is",
        "when should",
    ]

    question_match = any(pattern in latest_message for pattern in question_patterns)

    # Return True if we have keyword matches or question patterns
    return keyword_match or question_match


async def get_chat_context_summary(
    messages: List[Dict[str, Any]], repository_name: str = "woolly"
) -> str:
    """
    Generate a brief summary of the chat context for the agent

    This can be used to provide additional context to the agent
    about the ongoing conversation.

    Args:
        messages: List of chat messages
        repository_name: Repository name for context

    Returns:
        Brief summary of the conversation context
    """
    if len(messages) <= 2:
        return "New conversation"

    user_messages = [
        msg.get("content", "") for msg in messages if msg.get("role") == "user"
    ]

    if not user_messages:
        return "No user messages found"

    # Simple heuristic-based summary
    topics = []

    # Check for common topics
    all_content = " ".join(user_messages).lower()

    if any(
        word in all_content for word in ["code", "function", "class", "implementation"]
    ):
        topics.append("code discussion")

    if any(word in all_content for word in ["api", "endpoint", "service"]):
        topics.append("API discussion")

    if any(word in all_content for word in ["error", "bug", "issue", "problem"]):
        topics.append("troubleshooting")

    if any(word in all_content for word in ["test", "testing", "coverage"]):
        topics.append("testing")

    if any(word in all_content for word in ["documentation", "docs", "guide"]):
        topics.append("documentation")

    if topics:
        return f"Ongoing conversation about: {', '.join(topics)}"
    else:
        return f"General conversation ({len(user_messages)} user messages)"
