import os
import json
from typing import List, Optional
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI
from .utils.prompt import ClientMessage, convert_to_openai_messages
from .utils.tools import execute_python_code
from .utils.models import (
    Chat,
    Message,
    is_complete_json,
)
import uuid
from sqlalchemy.orm import Session
from .utils.database import get_db
from .utils.models import (
    build_tool_call_partial,
    build_tool_call_result,
    build_end_of_stream_message,
)
from datetime import datetime, timezone
from pydantic import ValidationError


load_dotenv(".env.local")

app = FastAPI()

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)


class Request(BaseModel):
    messages: List[ClientMessage]


class ChatTitleUpdate(BaseModel):
    title: str


class MessageCreate(BaseModel):
    role: str
    content: str
    toolInvocations: Optional[List[dict]] = None


available_tools = {
    "execute_python_code": execute_python_code,
}


def do_stream(messages: List[ChatCompletionMessageParam]):
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

    stream = client.chat.completions.create(
        messages=formatted_messages,
        model="gpt-4o",
        stream=True,
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


def stream_text(messages: List[ChatCompletionMessageParam], protocol: str = "data"):
    try:
        stream = do_stream(messages)
        current_tool_call = None
        current_args_buffer = []

        for chunk in stream:
            if not chunk.choices:
                continue

            delta = chunk.choices[0].delta

            # Handle tool calls
            if delta.tool_calls:
                for tool_call in delta.tool_calls:
                    if not current_tool_call:
                        current_tool_call = tool_call
                        current_args_buffer = []
                    if tool_call.function and tool_call.function.arguments:
                        current_args_buffer.append(tool_call.function.arguments)
                        args_so_far = "".join(current_args_buffer)

                        # Always send partial state
                        yield build_tool_call_partial(
                            tool_call_id=current_tool_call.id,
                            tool_name=current_tool_call.function.name,
                            args={"partial": args_so_far},
                        )

                        # Check if we have complete JSON
                        if is_complete_json(args_so_far):
                            try:
                                args = json.loads(args_so_far)
                                # Execute tool and emit result
                                result = available_tools[
                                    current_tool_call.function.name
                                ](**args)
                                yield build_tool_call_result(
                                    tool_call_id=current_tool_call.id,
                                    tool_name=current_tool_call.function.name,
                                    args=args,
                                    result=result,
                                )

                                # Reset state
                                current_tool_call = None
                                current_args_buffer = []
                            except json.JSONDecodeError:
                                # If JSON.loads fails despite our check, continue accumulating
                                continue

            # Handle regular content
            if delta.content:
                yield f"0:{{{json.dumps(delta.content)}}}\n\n"

        # End of stream
        if chunk.choices[0].finish_reason:
            yield build_end_of_stream_message(
                finish_reason=chunk.choices[0].finish_reason,
                prompt_tokens=chunk.usage.prompt_tokens if chunk.usage else 0,
                completion_tokens=chunk.usage.completion_tokens if chunk.usage else 0,
            )

    except Exception as e:
        print(f"Error in stream_text: {e}")
        yield f"0:{{{json.dumps(str(e))}}}\n\n"
        yield build_end_of_stream_message(
            finish_reason="error", prompt_tokens=0, completion_tokens=0
        )


# Chat CRUD Operations
@app.post("/api/chat/create")
async def create_chat(db: Session = Depends(get_db)):
    """Create a new chat and return its ID"""
    try:
        print("Creating new chat...")
        new_chat = Chat(
            id=uuid.uuid4(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

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
    chats = db.query(Chat).order_by(Chat.updated_at).all()
    return [
        {
            "id": str(chat.id),
            "created_at": chat.created_at.isoformat(),
            "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
            "title": (
                db.query(Message)
                .filter(Message.chat_id == chat.id)
                .order_by(Message.created_at.asc())
                .first()
                .content[:50]
                + "..."
                if db.query(Message).filter(Message.chat_id == chat.id).first()
                else "New Chat"
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

        new_message = Message(
            chat_id=chat_id,
            role="system",
            content=title_update.title,
            created_at=datetime.now(timezone.utc),
        )

        db.query(Message).filter(Message.chat_id == chat_id).filter(
            Message.role == "system"
        ).delete()

        db.add(new_message)
        db.commit()

        return {"success": True}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to update chat title: {str(e)}"
        )


# Message Operations
@app.get("/api/chat/{chat_id}/messages")
async def get_chat_messages(chat_id: uuid.UUID, db: Session = Depends(get_db)):
    """Fetch all messages for a specific chat"""
    messages = (
        db.query(Message)
        .filter(Message.chat_id == chat_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    return [
        {
            "id": str(message.id),
            "role": message.role,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
            "toolInvocations": message.tool_invocations or [],
        }
        for message in messages
    ]


@app.post("/api/chat/{chat_id}/messages/save")
async def save_chat_message(
    chat_id: uuid.UUID, message: MessageCreate, db: Session = Depends(get_db)
):
    try:
        tool_invocations = None
        if message.toolInvocations:
            tool_invocations = json.dumps([t for t in message.toolInvocations])

        db_message = Message(
            chat_id=chat_id,
            role=message.role,
            content=message.content,
            tool_invocations=tool_invocations,
            created_at=datetime.now(timezone.utc),
        )

        db.add(db_message)
        db.commit()
        db.refresh(db_message)

        return {"success": True, "message_id": str(db_message.id)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save message: {str(e)}")


# Chat Interaction Endpoints
@app.post("/api/chat/{chat_id}")
async def chat(
    chat_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    protocol: str = Query("data"),
):
    """Handle chat requests with streaming responses"""
    try:
        if not request.messages:
            raise HTTPException(
                status_code=422, detail="No messages provided in request"
            )

        # Store the user's message first
        user_message = Message(
            chat_id=chat_id,
            role="user",
            content=request.messages[-1].content,
            created_at=datetime.now(timezone.utc),
        )
        db.add(user_message)
        db.commit()

        # Convert messages to OpenAI format
        openai_messages = convert_to_openai_messages(request.messages)

        # Create async generator for streaming
        async def stream_chat():
            current_content = []
            tool_invocations = {}  # Use dict to track unique tool calls by ID

            for chunk in stream_text(openai_messages, protocol):
                prefix = chunk[0]
                json_str = chunk[2:].strip()

                data = None
                if is_complete_json(json_str):
                    data = json.loads(json_str)

                if prefix == "0":  # Regular content
                    if data is None:
                        current_content.append(
                            json_str.replace('{"', "").replace('"}', "")
                        )
                    elif isinstance(data, dict) and "content" in data:
                        current_content.append(data["content"])
                    yield chunk

                elif prefix == "9":  # Tool call partial
                    if isinstance(data, dict):
                        tool_invocations[data["toolCallId"]] = {
                            "toolCallId": data["toolCallId"],
                            "toolName": data["toolName"],
                            "args": data["args"],
                            "state": "partial-call",
                            "result": None,
                        }
                    yield chunk

                elif prefix == "a":  # Tool call result
                    if isinstance(data, dict):
                        tool_invocations[data["toolCallId"]] = {
                            "toolCallId": data["toolCallId"],
                            "toolName": data["toolName"],
                            "args": data["args"],
                            "state": "result",
                            "result": data["result"],
                        }
                    yield chunk

                elif prefix == "e":  # End of stream
                    if isinstance(data, dict):
                        final_content = "".join(current_content)

                        # Convert tool invocations dict to list, only keeping final states
                        final_tool_invocations = list(tool_invocations.values())

                        message = Message(
                            chat_id=chat_id,
                            role="assistant",
                            content=final_content,
                            tool_invocations=final_tool_invocations,
                            created_at=datetime.now(timezone.utc),
                        )
                        db.add(message)
                        db.commit()

                    yield chunk

        return StreamingResponse(
            stream_chat(),
            media_type="text/event-stream",
            headers={"x-vercel-ai-data-stream": "v1"},
        )

    except Exception as e:
        print("Unexpected error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


# Legacy Endpoint (Consider deprecating)
@app.post("/api/chat")
async def handle_chat_legacy(request: Request, protocol: str = Query("data")):
    """Legacy endpoint maintained for backward compatibility"""
    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)

    response = StreamingResponse(stream_text(openai_messages, protocol))
    response.headers["x-vercel-ai-data-stream"] = "v1"
    return response
