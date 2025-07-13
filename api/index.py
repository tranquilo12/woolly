import os
import json
from typing import List, Optional
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Depends, HTTPException
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
    build_tool_call_partial,
    build_tool_call_result,
    is_complete_json,
)
import uuid
from sqlalchemy.orm import Session
from .utils.database import get_db
from datetime import datetime, timezone, timedelta
from .routers import agents, universal_agents, triage, streaming_poc
from .utils.openai_client import get_openai_client
import logging


load_dotenv(".env.local")

app = FastAPI()
app.include_router(agents.router, prefix="/api")
app.include_router(universal_agents.router, prefix="/api/v1", tags=["universal-agents"])
app.include_router(triage.router, prefix="/api/v1", tags=["triage-agents"])
app.include_router(streaming_poc.router, tags=["streaming-poc"])

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
    stream = do_stream(messages, model=model)
    content_buffer = ""
    final_usage = None
    draft_tool_calls = []
    tool_invocations = []
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
                        # New tool call
                        draft_tool_calls_index += 1
                        draft_tool_calls.append(
                            {"id": id, "name": name, "arguments": "{}"}
                        )
                        # Stream partial tool call
                        yield build_tool_call_partial(
                            tool_call_id=id,
                            tool_name=name,
                            args={},  # Empty dict for initial call
                        )
                    elif arguments:
                        try:
                            # Accumulate arguments
                            current_args = draft_tool_calls[draft_tool_calls_index][
                                "arguments"
                            ]
                            # Concatenate argument strings
                            draft_tool_calls[draft_tool_calls_index]["arguments"] = (
                                current_args.rstrip("}") + arguments.lstrip("{")
                            )

                            # Only try to parse and stream if we have complete JSON
                            if is_complete_json(
                                draft_tool_calls[draft_tool_calls_index]["arguments"]
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
                                    tool_name=draft_tool_calls[draft_tool_calls_index][
                                        "name"
                                    ],
                                    args=parsed_args,
                                )
                        except json.JSONDecodeError:
                            # Skip streaming for incomplete JSON
                            continue

            elif choice.finish_reason == "tool_calls":
                for tool_call in draft_tool_calls:
                    try:
                        parsed_args = json.loads(tool_call["arguments"])
                        tool_result = available_tools[tool_call["name"]](**parsed_args)

                        # First, append to tool_invocations for database
                        tool_invocations.append(
                            {
                                "toolCallId": tool_call["id"],
                                "toolName": tool_call["name"],
                                "args": parsed_args,
                                "result": tool_result,
                                "state": "result",
                            }
                        )

                        # Then yield the properly formatted result for streaming
                        yield build_tool_call_result(
                            tool_call_id=tool_call["id"],
                            tool_name=tool_call["name"],
                            args=parsed_args,
                            result=tool_result,
                        )
                    except Exception as e:
                        print(f"Tool execution error: {e}")
                        error_result = {"error": str(e)}

                        # Add error state to tool_invocations
                        tool_invocations.append(
                            {
                                "id": tool_call["id"],
                                "toolName": tool_call["name"],
                                "args": {},
                                "result": error_result,
                                "state": "error",
                            }
                        )

                        # Stream error result
                        yield build_tool_call_result(
                            tool_call_id=tool_call["id"],
                            tool_name=tool_call["name"],
                            args={},
                            result=error_result,
                        )

            else:
                content = choice.delta.content or ""
                content_buffer += content
                yield f"0:{json.dumps(content)}\n"

        if chunk.choices == []:
            usage = chunk.usage
            prompt_tokens = usage.prompt_tokens
            completion_tokens = usage.completion_tokens
            final_usage = usage

            yield 'e:{{"finishReason":"{reason}","usage":{{"promptTokens":{prompt},"completionTokens":{completion},"totalTokens":{total}}},"isContinued":false}}\n'.format(
                reason="stop",
                prompt=prompt_tokens,
                completion=completion_tokens,
                total=prompt_tokens + completion_tokens,
            )

    # After the stream is complete
    if final_usage and db and message_id:
        try:
            message = db.query(Message).filter(Message.id == message_id).first()
            if message:
                message.content = content_buffer
                message.prompt_tokens = final_usage.prompt_tokens
                message.completion_tokens = final_usage.completion_tokens
                message.total_tokens = (
                    final_usage.prompt_tokens + final_usage.completion_tokens
                )
                message.tool_invocations = tool_invocations
                db.commit()
        except Exception as e:
            print(f"Failed to update message: {e}")


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
        db.query(Message).filter(Message.chat_id == chat_id).delete()
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
            headers={"x-vercel-ai-data-stream": "v1"},
        )
    except Exception as e:
        print("Unexpected error:", str(e))
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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
            stream_text(openai_messages, protocol, model=request.model)
        )
        response.headers["x-vercel-ai-data-stream"] = "v1"
        return response
    except Exception as e:
        logging.error(f"Error in legacy chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
