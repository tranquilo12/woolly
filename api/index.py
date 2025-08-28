import os
import json
from typing import List, Optional
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from .utils.prompt import (
    Attachment,
    ClientMessage,
    convert_to_openai_messages,
)
from .utils.tools import execute_python_code
from .utils.models import (
    Chat,
    Message,
    Agent,
    ChatInsight,
    build_tool_call_partial,
    build_tool_call_result,
    build_text_stream,
    build_message_start,
    build_message_end,
    build_end_of_stream_message,
    is_complete_json,
    TitleGenerateRequest,
    TitleGenerateResponse,
    SummaryGenerateRequest,
    SummaryGenerateResponse,
    RollingSummaryRequest,
)
import uuid
from sqlalchemy.orm import Session
from .utils.database import get_db
from datetime import datetime, timezone, timedelta
from .routers import agents, universal_agents, triage, streaming_poc, mcp_control
from .utils.openai_client import get_openai_client
import logging
from .utils.ai_services import (
    generate_title_from_first_user_message,
    generate_full_summary,
    generate_rolling_summary,
)
from .utils.pydantic_chat import (
    stream_pydantic_chat,
    should_use_mcp_tools,
    get_chat_context_summary,
)
from .utils.mcp_status import (
    get_mcp_status_service,
    MCPStatusResponse,
    initialize_mcp_monitoring,
)
from .utils.mcp_registry import get_mcp_registry
from contextlib import asynccontextmanager
import os


load_dotenv(".env.local")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown"""
    # Startup
    try:
        # Initialize MCP monitoring
        await initialize_mcp_monitoring()

        # Register MCP server from environment if available
        mcp_server_url = os.getenv("MCP_SERVER_URL")
        if mcp_server_url:
            try:
                from pydantic_ai.mcp import MCPServerStreamableHTTP

                # Create and register MCP server in registry
                mcp_server = MCPServerStreamableHTTP(mcp_server_url)
                registry = get_mcp_registry()
                await registry.register(mcp_server, mcp_server_url)

                logging.info(
                    f"✅ MCP server registered from environment: {mcp_server_url}"
                )
            except Exception as mcp_error:
                logging.warning(
                    f"⚠️ Failed to register MCP server from environment: {mcp_error}"
                )
        else:
            logging.info("ℹ️ No MCP_SERVER_URL provided - MCP functionality disabled")

        logging.info("🚀 Application startup complete")
    except Exception as e:
        logging.error(f"Startup error: {e}")

    yield

    # Shutdown
    try:
        from .utils.mcp_status import shutdown_mcp_monitoring

        # Deregister MCP server
        try:
            registry = get_mcp_registry()
            await registry.deregister()
            logging.info("🔌 MCP server deregistered")
        except Exception as mcp_error:
            logging.warning(f"⚠️ Failed to deregister MCP server: {mcp_error}")

        await shutdown_mcp_monitoring()
        logging.info("🛑 Application shutdown complete")
    except Exception as e:
        logging.error(f"Shutdown error: {e}")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:80", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(agents.router, prefix="/api")
app.include_router(universal_agents.router, prefix="/api/v1", tags=["universal-agents"])
app.include_router(triage.router, prefix="/api/v1", tags=["triage-agents"])
app.include_router(streaming_poc.router, tags=["streaming-poc"])
app.include_router(mcp_control.router, tags=["mcp-control"])

client = get_openai_client(async_client=False)


@app.get("/api/health")
async def health_check():
    """Health check endpoint for Docker healthcheck"""
    return {"status": "healthy"}


class ToolInvocation(BaseModel):
    id: str
    function: Optional[dict] = None
    toolName: Optional[str] = None
    args: Optional[dict] = None
    state: str
    result: Optional[dict] = None


class ClientMessageWithTools(BaseModel):
    role: str
    content: str
    id: Optional[str] = None
    toolInvocations: Optional[List[ToolInvocation]] = None
    model: Optional[str] = None
    experimental_attachments: Optional[List[Attachment]] = None


class RequestFromFrontend(BaseModel):
    messages: List[ClientMessageWithTools]
    model: Optional[str] = "gpt-4o"
    agent_id: Optional[str] = None


class ChatTitleUpdate(BaseModel):
    title: str


class MessageCreate(BaseModel):
    role: str
    content: str
    toolInvocations: Optional[List[dict]] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None


class MessageEdit(BaseModel):
    content: str


available_tools = {
    "execute_python_code": execute_python_code,
}


def do_stream(messages: List[ChatCompletionMessageParam], model: str = "gpt-4o"):
    # Validate messages to ensure we don't send an empty array to OpenAI
    if not messages:
        logging.warning(
            "Empty messages array received in do_stream. Adding default system message."
        )
        # Add a default system message to prevent the empty array error
        messages = [{"role": "system", "content": "You are a helpful assistant."}]

    # Additional validation: ensure each message has required fields
    validated_messages = []
    for msg in messages:
        if isinstance(msg, dict):
            # Ensure each message has at least role and content
            if "role" not in msg:
                logging.warning("Message missing 'role' field, skipping")
                continue
            if "content" not in msg and "experimental_attachments" not in msg:
                logging.warning(
                    "Message missing both 'content' and 'experimental_attachments' fields, skipping"
                )
                continue
            validated_messages.append(msg)
        else:
            logging.warning(f"Invalid message format: {type(msg)}, skipping")

    # If all messages were invalid, add a default system message
    if not validated_messages:
        logging.warning("All messages were invalid. Adding default system message.")
        validated_messages = [
            {"role": "system", "content": "You are a helpful assistant."}
        ]

    # Use validated messages for the rest of the function
    messages = validated_messages

    # Convert messages to the format expected by OpenAI Vision API
    formatted_messages = []

    for msg in messages:
        if isinstance(msg, dict) and msg.get("experimental_attachments"):
            # Handle messages with attachments
            attachments = msg["experimental_attachments"]
            content = [
                {"type": "text", "text": msg.get("content", "")},
            ]

            # Add each attachment as an image URL
            for attachment in attachments:
                if attachment.get("contentType", "").startswith("image/"):
                    content.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": attachment["url"], "detail": "auto"},
                        }
                    )

            formatted_messages.append({"role": msg["role"], "content": content})
        else:
            # Handle regular text messages
            formatted_messages.append(msg)

    # Final validation to ensure we don't send empty messages to OpenAI
    if not formatted_messages:
        logging.error("Empty formatted_messages in do_stream after processing")
        formatted_messages = [
            {"role": "system", "content": "You are a helpful assistant."}
        ]

    # Log the final messages for debugging
    logging.info(f"Sending {len(formatted_messages)} messages to OpenAI")
    for i, msg in enumerate(formatted_messages):
        role = msg.get("role", "unknown")
        content_type = type(msg.get("content", ""))
        content_preview = (
            str(msg.get("content", ""))[:50] + "..."
            if len(str(msg.get("content", ""))) > 50
            else str(msg.get("content", ""))
        )
        logging.info(
            f"Message {i}: role={role}, content_type={content_type}, content_preview={content_preview}"
        )

    try:
        stream = client.chat.completions.create(
            messages=formatted_messages,
            model=model,
            stream=True,
            stream_options={"include_usage": True},
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "execute_python_code",
                        "description": "Execute Python code",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "code": {
                                    "type": "string",
                                    "description": "The Python code to execute",
                                },
                                "output_format": {
                                    "type": "string",
                                    "description": "The format of the output",
                                },
                            },
                            "required": ["code", "output_format"],
                        },
                    },
                }
            ],
        )
        return stream
    except Exception as e:
        logging.error(f"Error in do_stream: {str(e)}")

        # Provide more detailed error information
        error_details = str(e)

        # Check for specific error types
        if "messages" in error_details.lower():
            logging.error("Error related to messages format")
            # Log the messages that caused the error
            for i, msg in enumerate(formatted_messages):
                logging.error(f"Message {i}: {msg}")
        elif "api key" in error_details.lower():
            logging.error("Error related to API key")
        elif "rate limit" in error_details.lower():
            logging.error("Rate limit exceeded")
        elif "model" in error_details.lower():
            logging.error("Error related to model selection")

        # Re-raise the exception with more context
        raise Exception(f"OpenAI API error: {error_details}") from e


def stream_text(
    messages: List[ChatCompletionMessageParam],
    protocol: str = "data",
    model: str = "gpt-4o",
    db: Session = None,
    message_id: uuid.UUID = None,
):
    assistant_message_id = str(uuid.uuid4())
    content_buffer = ""
    final_usage = None
    tool_invocations = []
    error_occurred = None

    # Start the message with proper AI SDK V5 format
    yield build_message_start(assistant_message_id, "assistant")

    try:
        stream = do_stream(messages, model=model)
        draft_tool_calls = []
        draft_tool_calls_index = -1

        for chunk in stream:
            for choice in chunk.choices:
                if choice.delta.tool_calls:
                    for tool_call in choice.delta.tool_calls:
                        id = tool_call.id
                        name = tool_call.function.name if tool_call.function else None
                        arguments = (
                            tool_call.function.arguments if tool_call.function else None
                        )

                        if id is not None:
                            draft_tool_calls_index += 1
                            draft_tool_calls.append(
                                {"id": id, "name": name, "arguments": "{}"}
                            )
                            yield build_tool_call_partial(
                                tool_call_id=id,
                                tool_name=name,
                                args={},
                            )
                        elif arguments:
                            try:
                                current_args = draft_tool_calls[draft_tool_calls_index][
                                    "arguments"
                                ]
                                draft_tool_calls[draft_tool_calls_index][
                                    "arguments"
                                ] = current_args.rstrip("}") + arguments.lstrip("{")
                                if is_complete_json(
                                    draft_tool_calls[draft_tool_calls_index][
                                        "arguments"
                                    ]
                                ):
                                    parsed_args = json.loads(
                                        draft_tool_calls[draft_tool_calls_index][
                                            "arguments"
                                        ]
                                    )
                                    yield build_tool_call_partial(
                                        tool_call_id=draft_tool_calls[
                                            draft_tool_calls_index
                                        ]["id"],
                                        tool_name=draft_tool_calls[
                                            draft_tool_calls_index
                                        ]["name"],
                                        args=parsed_args,
                                    )
                            except json.JSONDecodeError:
                                continue

                elif choice.finish_reason == "tool_calls":
                    for tool_call in draft_tool_calls:
                        try:
                            parsed_args = json.loads(tool_call["arguments"])
                            tool_result = available_tools[tool_call["name"]](
                                **parsed_args
                            )
                            tool_invocations.append(
                                {
                                    "toolCallId": tool_call["id"],
                                    "toolName": tool_call["name"],
                                    "args": parsed_args,
                                    "result": tool_result,
                                    "state": "result",
                                }
                            )
                            yield build_tool_call_result(
                                tool_call_id=tool_call["id"],
                                tool_name=tool_call["name"],
                                args=parsed_args,
                                result=tool_result,
                            )
                        except Exception as e:
                            print(f"Tool execution error: {e}")
                            error_result = {"error": str(e)}
                            tool_invocations.append(
                                {
                                    "id": tool_call["id"],
                                    "toolName": tool_call["name"],
                                    "args": {},
                                    "result": error_result,
                                    "state": "error",
                                }
                            )
                            yield build_tool_call_result(
                                tool_call_id=tool_call["id"],
                                tool_name=tool_call["name"],
                                args={},
                                result=error_result,
                            )
                else:
                    content = choice.delta.content or ""
                    content_buffer += content
                    # Only stream non-empty content to prevent AI SDK v5 buffering issues
                    if content:
                        yield build_text_stream(content)

            if chunk.choices == [] and hasattr(chunk, "usage") and chunk.usage:
                final_usage = chunk.usage

    except Exception as e:
        error_occurred = e
        logging.error(f"Error during OpenAI stream: {e}", exc_info=True)
        error_message = f"\n\nAn error occurred: {str(e)}"
        content_buffer += error_message
        yield build_text_stream(error_message)

    finally:
        # Always end the message and stream, even if errors occurred
        yield build_message_end(assistant_message_id, "assistant", content_buffer)

        finish_reason = "error" if error_occurred else "stop"

        if final_usage:
            yield build_end_of_stream_message(
                finish_reason=finish_reason,
                prompt_tokens=final_usage.prompt_tokens,
                completion_tokens=final_usage.completion_tokens,
                is_continued=False,
            )
        else:
            yield build_end_of_stream_message(
                finish_reason=finish_reason,
                prompt_tokens=0,
                completion_tokens=len(content_buffer.split()),
                is_continued=False,
            )

        # Update database after stream completion
        if db and message_id:
            try:
                message = db.query(Message).filter(Message.id == message_id).first()
                if message:
                    message.content = content_buffer
                    if final_usage:
                        message.prompt_tokens = final_usage.prompt_tokens
                        message.completion_tokens = final_usage.completion_tokens
                        message.total_tokens = (
                            final_usage.prompt_tokens + final_usage.completion_tokens
                        )
                    message.tool_invocations = tool_invocations
                    db.commit()
            except Exception as e:
                logging.error(f"Failed to update message in DB: {e}", exc_info=True)


# Chat CRUD Operations
@app.post("/api/chat/create")
async def create_chat(agent_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Create a new chat and return its ID"""
    try:
        print("Creating new chat...")
        new_chat = Chat(
            id=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            title="New Chat",
        )

        if agent_id:
            agent = (
                db.query(Agent)
                .filter(Agent.id == agent_id, Agent.is_active == True)
                .first()
            )
            if agent:
                new_chat.agent_id = agent.id

        db.add(new_chat)
        db.commit()
        db.refresh(new_chat)

        chat_id = str(new_chat.id)
        print(f"Successfully created chat with ID: {chat_id}")

        return {"id": chat_id}
    except Exception as e:
        db.rollback()
        print(f"Error creating chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create chat: {str(e)}")


@app.get("/api/chats")
async def get_chats(db: Session = Depends(get_db)):
    """Fetch all chats ordered by last updated"""
    chats = db.query(Chat).order_by(Chat.updated_at.desc()).all()
    return [
        {
            "id": str(chat.id),
            "created_at": chat.created_at.isoformat(),
            "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
            "title": (
                chat.title
                if chat.title
                else (
                    db.query(Message)
                    .filter(Message.chat_id == chat.id)
                    .order_by(Message.created_at.asc())
                    .first()
                    .content[:50]
                    + "..."
                    if db.query(Message).filter(Message.chat_id == chat.id).first()
                    else "New Chat"
                )
            ),
        }
        for chat in chats
    ]


@app.delete("/api/chat/{chat_id}")
async def delete_chat(chat_id: uuid.UUID, db: Session = Depends(get_db)):
    """Delete a chat and its messages"""
    try:
        # Delete related records in the correct order to avoid foreign key violations
        # 1. Delete chat insights first
        db.query(ChatInsight).filter(ChatInsight.chat_id == chat_id).delete()

        # 2. Delete messages
        db.query(Message).filter(Message.chat_id == chat_id).delete()

        # 3. Finally delete the chat itself
        result = db.query(Chat).filter(Chat.id == chat_id).delete()
        if not result:
            raise HTTPException(status_code=404, detail="Chat not found")

        db.commit()
        return {"success": True}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete chat: {str(e)}")


# Chat Title Operations
@app.patch("/api/chat/{chat_id}/title")
async def update_chat_title(
    chat_id: uuid.UUID, title_update: ChatTitleUpdate, db: Session = Depends(get_db)
):
    """Update chat title"""
    try:
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        # Update the chat title
        chat.title = title_update.title
        chat.updated_at = datetime.now(timezone.utc)
        db.commit()

        return {"success": True, "title": chat.title}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to update chat title: {str(e)}"
        )


# Message Operations
@app.get("/api/chat/{chat_id}/messages")
async def get_chat_messages(chat_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get all messages for a chat, excluding agent messages"""
    try:
        messages = (
            db.query(Message)
            .filter(
                Message.chat_id == chat_id,
                Message.agent_id.is_(None),  # Explicitly exclude agent messages
                Message.message_type.is_(None),  # Ensure no message type
                Message.role.in_(
                    ["user", "assistant"]
                ),  # Only include user and assistant messages
            )
            .order_by(Message.created_at)
            .all()
        )

        # Log the message retrieval for debugging
        logging.info(f"Retrieved {len(messages)} non-agent messages for chat {chat_id}")

        return messages
    except Exception as e:
        logging.error(f"Error retrieving chat messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/{chat_id}/messages")
async def create_message(
    chat_id: uuid.UUID, message: MessageCreate, db: Session = Depends(get_db)
):
    try:
        # First, verify that the chat exists
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            raise HTTPException(
                status_code=404, detail=f"Chat with ID {chat_id} not found"
            )

        print("[DEBUG] create_message called with:", message.model_dump())

        # Ensure no agent fields are present for regular chat messages
        db_message = Message(
            id=uuid.uuid4(),
            chat_id=chat_id,
            role=message.role,
            content=message.content,
            tool_invocations=message.toolInvocations,
            prompt_tokens=message.prompt_tokens,
            completion_tokens=message.completion_tokens,
            total_tokens=message.total_tokens,
            # Explicitly set agent fields to None
            agent_id=None,
            message_type=None,
            repository=None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(db_message)
        db.commit()
        return db_message
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# Chat Interaction Endpoints
@app.post("/api/chat/{chat_id}")
async def chat(
    chat_id: uuid.UUID,
    request: RequestFromFrontend,
    db: Session = Depends(get_db),
    protocol: str = Query("data"),
):
    try:
        # Check if the chat exists, create it if it doesn't
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            # Auto-create the missing chat
            logging.info(f"Chat {chat_id} not found, auto-creating new chat")
            chat = Chat(
                id=chat_id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                title="New Chat",
            )
            db.add(chat)
            db.flush()  # Flush to get the chat in the session without committing yet
            logging.info(f"Successfully created new chat {chat_id}")
        else:
            logging.info(f"Using existing chat {chat_id}")

        messages = request.messages
        if not messages:
            raise HTTPException(status_code=422, detail="No messages provided")

        model = request.model or messages[-1].model or "gpt-4o"

        # Check if the last message is from user and already exists
        last_message = messages[-1]
        if last_message.role == "user":
            existing_message = (
                db.query(Message)
                .filter(
                    Message.chat_id == chat_id,
                    Message.role == "user",
                    Message.content == last_message.content,
                )
                .first()
            )

            # Only create new user message if it doesn't exist
            if not existing_message:
                user_message = Message(
                    chat_id=chat_id,
                    role=last_message.role,
                    content=last_message.content,
                    model=model,
                    created_at=datetime.now(timezone.utc),
                    agent_id=None,  # Explicitly set to None
                    message_type=None,  # Explicitly set to None
                )
                db.add(user_message)
                db.flush()

        # Find existing empty assistant message
        existing_assistant = (
            db.query(Message)
            .filter(
                Message.chat_id == chat_id,
                Message.role == "assistant",
                Message.content == "",
                Message.created_at >= datetime.now(timezone.utc) - timedelta(minutes=5),
            )
            .order_by(Message.created_at.desc())
            .first()
        )

        if existing_assistant:
            # Update existing message
            assistant_message = existing_assistant
            assistant_message.model = model
        else:
            # Create new assistant message only if none exists
            assistant_message = Message(
                chat_id=chat_id,
                role="assistant",
                content="",
                model=model,
                created_at=datetime.now(timezone.utc),
                agent_id=None,  # Explicitly set to None
                message_type=None,  # Explicitly set to None
            )
            db.add(assistant_message)

        db.commit()

        openai_messages = convert_to_openai_messages(messages)

        return StreamingResponse(
            stream_text(
                openai_messages,
                protocol,
                model=model,
                db=db,
                message_id=assistant_message.id,
            ),
            media_type="text/plain; charset=utf-8",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Transfer-Encoding": "chunked",
                "Content-Encoding": "none",
            },
        )
    except HTTPException:
        # Re-raise HTTP exceptions (like 404 for missing chat)
        db.rollback()
        raise
    except Exception as e:
        print("Unexpected error:", str(e))
        db.rollback()

        # Provide more specific error messages for common database issues
        error_message = str(e)
        if "foreign key constraint" in error_message.lower():
            if "chat_id" in error_message:
                raise HTTPException(
                    status_code=404,
                    detail="Chat not found. Please create a new chat or use an existing chat ID.",
                )

        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# NEW: Pydantic AI Chat Endpoint with MCP Integration
@app.post("/api/chat/{chat_id}/ai")
async def chat_with_pydantic_ai(
    chat_id: uuid.UUID,
    request: RequestFromFrontend,
    db: Session = Depends(get_db),
    repository_name: str = Query(
        "woolly", description="Repository name for MCP context"
    ),
):
    """
    NEW: Pydantic AI-powered chat with MCP tool integration

    This endpoint provides the same AI SDK V5 streaming format as the regular
    chat endpoint but with full MCP tool access for code-aware conversations.

    Features:
    - Full MCP tool access (search_code, find_entities, qa_codebase, etc.)
    - Same AI SDK V5 streaming format as existing chat
    - Automatic code context detection
    - Repository-aware responses
    - Conversation history preservation

    Usage:
    - Use this endpoint when you want code-aware chat responses
    - Automatically detects when MCP tools would be helpful
    - Maintains same interface as regular chat endpoint
    """
    try:
        # Same chat setup as regular endpoint
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            # Auto-create the missing chat
            logging.info(f"Chat {chat_id} not found, auto-creating new chat")
            chat = Chat(
                id=chat_id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                title="New AI Chat",
            )
            db.add(chat)
            db.flush()
            logging.info(f"Successfully created new AI chat {chat_id}")
        else:
            logging.info(f"Using existing AI chat {chat_id}")

        messages = request.messages
        if not messages:
            raise HTTPException(status_code=422, detail="No messages provided")

        model = request.model or messages[-1].model or "gpt-4o"

        # Create user message if it's new
        last_message = messages[-1]
        if last_message.role == "user":
            existing_message = (
                db.query(Message)
                .filter(
                    Message.chat_id == chat_id,
                    Message.role == "user",
                    Message.content == last_message.content,
                )
                .first()
            )

            if not existing_message:
                user_message = Message(
                    chat_id=chat_id,
                    role=last_message.role,
                    content=last_message.content,
                    model=model,
                    created_at=datetime.now(timezone.utc),
                    agent_id=None,
                    message_type=None,
                )
                db.add(user_message)
                db.flush()

        # Create assistant message placeholder
        existing_assistant = (
            db.query(Message)
            .filter(
                Message.chat_id == chat_id,
                Message.role == "assistant",
                Message.content == "",
                Message.created_at >= datetime.now(timezone.utc) - timedelta(minutes=5),
            )
            .order_by(Message.created_at.desc())
            .first()
        )

        if existing_assistant:
            assistant_message = existing_assistant
            assistant_message.model = model
        else:
            assistant_message = Message(
                chat_id=chat_id,
                role="assistant",
                content="",
                model=model,
                created_at=datetime.now(timezone.utc),
                agent_id=None,
                message_type=None,
            )
            db.add(assistant_message)

        db.commit()

        # Log the switch to Pydantic AI
        logging.info(
            f"Using Pydantic AI chat for {chat_id} with repository: {repository_name}"
        )

        # Convert Pydantic models to dictionaries for the utility function
        messages_dict = [
            msg.model_dump() if hasattr(msg, "model_dump") else msg.__dict__
            for msg in messages
        ]

        # Check MCP server status
        mcp_service = get_mcp_status_service()
        mcp_status = mcp_service.get_status()

        # Check if MCP tools would be beneficial
        use_mcp = should_use_mcp_tools(messages_dict)
        logging.info(
            f"MCP tools recommended: {use_mcp}, MCP available: {mcp_status.available}"
        )

        # Use Pydantic AI streaming with MCP access
        return StreamingResponse(
            stream_pydantic_chat(
                messages=messages_dict,
                model=model,
                repository_name=repository_name,
                chat_id=chat_id,
                db=db,
            ),
            media_type="text/plain; charset=utf-8",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Transfer-Encoding": "chunked",
                "Content-Encoding": "none",
                "X-Chat-Type": "pydantic-ai",  # Header to identify the chat type
                "X-MCP-Enabled": str(mcp_status.available).lower(),
                "X-MCP-Status": mcp_status.status.value,
                "X-MCP-Fallback": str(mcp_status.fallback_mode).lower(),
                "X-MCP-Capabilities": ",".join(mcp_status.capabilities),
                "X-Repository": repository_name,
            },
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logging.error(f"Pydantic AI chat error: {str(e)}", exc_info=True)
        db.rollback()

        # Provide specific error messages
        error_message = str(e)
        if "mcp" in error_message.lower():
            raise HTTPException(
                status_code=503,
                detail="MCP server unavailable. Please try again later or use the regular chat endpoint.",
            )
        elif "agent" in error_message.lower():
            raise HTTPException(
                status_code=500,
                detail="AI agent system unavailable. Please try the regular chat endpoint.",
            )

        raise HTTPException(status_code=500, detail=f"AI chat error: {str(e)}")


# MCP Status Endpoint
@app.get("/api/mcp/status", response_model=MCPStatusResponse)
async def get_mcp_status():
    """
    Get current MCP server status and capabilities

    This endpoint provides real-time information about MCP server availability,
    capabilities, and connection health for frontend consumption.

    Returns:
        MCPStatusResponse: Current MCP server status and details
    """
    try:
        mcp_service = get_mcp_status_service()

        # Force a fresh status check
        await mcp_service.force_check()

        return mcp_service.get_status()

    except Exception as e:
        logging.error(f"MCP status check error: {e}")
        # Return a failed status response
        from .utils.mcp_status import MCPStatus

        return MCPStatusResponse(
            status=MCPStatus.FAILED,
            available=False,
            capabilities=[],
            fallback_mode=True,
            server_info={"error": str(e)},
            error_details={"message": str(e)},
        )


# Legacy Endpoint (Consider deprecating)
@app.post("/api/chat")
async def handle_chat_legacy(
    request: RequestFromFrontend, protocol: str = Query("data")
):
    """Legacy endpoint maintained for backward compatibility"""
    messages = request.messages

    # Check if messages array is empty and add a default system message if needed
    if not messages:
        logging.warning(
            "Empty messages array received in legacy chat endpoint. Adding default system message."
        )
        # Add a default system message to prevent the empty array error
        messages = [
            ClientMessageWithTools(
                role="system",
                content="You are a helpful assistant.",
                id=str(uuid.uuid4()),
            )
        ]

    openai_messages = convert_to_openai_messages(messages)

    # Additional validation to ensure we don't send empty messages to OpenAI
    if not openai_messages:
        logging.error("Empty openai_messages after conversion in legacy chat endpoint")
        raise HTTPException(
            status_code=400,
            detail="Unable to process empty message array. Please provide at least one message.",
        )

    try:
        response = StreamingResponse(
            stream_text(openai_messages, protocol, model=request.model),
            media_type="text/plain; charset=utf-8",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Transfer-Encoding": "chunked",
                "Content-Encoding": "none",
            },
        )
        return response
    except Exception as e:
        logging.error(f"Error in legacy chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/{chat_id}/generate-title", response_model=TitleGenerateResponse)
async def generate_chat_title_endpoint(
    chat_id: uuid.UUID,
    req: TitleGenerateRequest,
    db: Session = Depends(get_db),
):
    """Generate a concise 2-3 word title from the first user message."""
    # Validate chat exists
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    model = (req.model or "gpt-4o-mini").strip()
    result = await generate_title_from_first_user_message(
        db=db, chat_id=chat_id, model=model
    )
    # Optionally persist title to chat table
    if result.get("title"):
        chat.title = result["title"]
        chat.updated_at = datetime.now(timezone.utc)
        db.commit()
    return TitleGenerateResponse(**result)


@app.post(
    "/api/chat/{chat_id}/generate-summary", response_model=SummaryGenerateResponse
)
async def generate_full_summary_endpoint(
    chat_id: uuid.UUID,
    req: SummaryGenerateRequest,
    db: Session = Depends(get_db),
):
    """Generate a full summary of the conversation."""
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    model = (req.model or "gpt-4o-mini").strip()
    result = await generate_full_summary(db=db, chat_id=chat_id, model=model)
    return SummaryGenerateResponse(**result)


@app.post(
    "/api/chat/{chat_id}/generate-rolling-summary",
    response_model=SummaryGenerateResponse,
)
async def generate_rolling_summary_endpoint(
    chat_id: uuid.UUID,
    req: RollingSummaryRequest,
    db: Session = Depends(get_db),
):
    """Generate a rolling summary skipping the first N interactions."""
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    model = (req.model or "gpt-4o-mini").strip()
    skip_n = max(0, int(req.skip_interactions))
    result = await generate_rolling_summary(
        db=db, chat_id=chat_id, skip_interactions=skip_n, model=model
    )
    return SummaryGenerateResponse(**result)


@app.patch("/api/chat/{chat_id}/messages/{message_id}")
async def edit_message(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    message: MessageEdit,
    db: Session = Depends(get_db),
):
    """Edit a message and remove all subsequent messages"""
    try:
        # Find the message to edit
        target_message = (
            db.query(Message)
            .filter(Message.chat_id == chat_id, Message.id == message_id)
            .first()
        )

        if not target_message:
            raise HTTPException(status_code=404, detail="Message not found")

        # Get message creation time to find subsequent messages
        message_time = target_message.created_at

        # Delete all messages that came after this one
        db.query(Message).filter(
            Message.chat_id == chat_id, Message.created_at > message_time
        ).delete()

        # Update the target message
        target_message.content = message.content
        db.commit()

        return {"success": True}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to edit message: {str(e)}")


@app.patch("/api/chat/{chat_id}/messages/{message_id}/model")
async def update_message_model(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    model_update: dict,
    db: Session = Depends(get_db),
):
    """Update message model"""
    try:
        # Find the message to update
        message = (
            db.query(Message)
            .filter(Message.chat_id == chat_id, Message.id == message_id)
            .first()
        )

        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        # Update the model
        message.model = model_update.get("model")
        db.commit()

        return {"success": True}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to update message model: {str(e)}"
        )


@app.get("/api/chat/{chat_id}/agent/messages")
async def get_agent_messages(
    chat_id: uuid.UUID,
    agent_id: str = Query(None),
    repository: str = Query(None),
    message_type: str = Query(None),
    pipeline_id: str = Query(None),
    db: Session = Depends(get_db),
):
    """Get messages for a specific agent in a chat"""
    try:
        # Start with a base query
        query = db.query(Message)

        # Add base filter for chat_id
        query = query.filter(Message.chat_id == chat_id)

        # Add optional filters
        if agent_id:
            query = query.filter(Message.agent_id == agent_id)
        if repository:
            query = query.filter(Message.repository == repository)
        if message_type:
            query = query.filter(Message.message_type == message_type)
        if pipeline_id:
            query = query.filter(Message.pipeline_id == pipeline_id)

        # Get messages ordered by creation time
        messages = query.order_by(Message.created_at).all()

        # Always return a list, even if empty
        return messages or []

    except Exception as e:
        logging.error(f"Error retrieving agent messages: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve messages: {str(e)}"
        )


@app.get("/api/docs_system_prompt.txt")
async def get_docs_system_prompt():
    with open("./api/docs_system_prompt.txt", "r") as file:
        return file.read()


@app.delete("/api/chat/{chat_id}/messages/{message_id}")
async def delete_message(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Delete a specific message from a chat"""
    try:
        # Find and delete the message
        result = (
            db.query(Message)
            .filter(Message.chat_id == chat_id, Message.id == message_id)
            .delete()
        )

        if not result:
            raise HTTPException(status_code=404, detail="Message not found")

        db.commit()
        return {"success": True}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to delete message: {str(e)}"
        )


@app.post("/api/chat/{chat_id}/agent/messages")
async def create_agent_message(
    chat_id: uuid.UUID, message: dict, db: Session = Depends(get_db)
):
    """Create a new agent message"""
    try:
        # First, verify that the chat exists
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            raise HTTPException(
                status_code=404, detail=f"Chat with ID {chat_id} not found"
            )

        # Extract pipeline_id from the message if it exists
        pipeline_id = message.get("pipeline_id")

        # Create a new message with the agent_id, repository, message_type, and pipeline_id
        db_message = Message(
            id=uuid.uuid4(),
            chat_id=chat_id,
            agent_id=message["agent_id"],
            repository=message["repository"],
            message_type=message["message_type"],
            pipeline_id=pipeline_id,  # Add pipeline_id
            role=message["role"],
            content=message["content"],
            model=message.get("model"),
            tool_invocations=message.get("tool_invocations", []),
            created_at=datetime.now(timezone.utc),
            iteration_index=message.get("iteration_index"),
            step_index=message.get("step_index"),
            step_title=message.get("step_title"),
        )

        db.add(db_message)
        db.commit()
        return db_message
    except Exception as e:
        db.rollback()
        logging.error(f"Failed to create agent message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
