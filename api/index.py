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
from datetime import datetime, timezone


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
    stream = do_stream(messages)
    draft_tool_calls = []
    draft_tool_calls_index = -1
    for chunk in stream:
        for choice in chunk.choices:
            if choice.finish_reason == "stop":
                continue

            elif choice.finish_reason == "tool_calls":
                for tool_call in draft_tool_calls:
                    yield '9:{{"toolCallId":"{id}","toolName":"{name}","args":{args}}}\n'.format(
                        id=tool_call["id"],
                        name=tool_call["name"],
                        args=tool_call["arguments"],
                    )

                for tool_call in draft_tool_calls:
                    tool_result = available_tools[tool_call["name"]](
                        **json.loads(tool_call["arguments"])
                    )

                    yield 'a:{{"toolCallId":"{id}","toolName":"{name}","args":{args},"result":{result}}}\n'.format(
                        id=tool_call["id"],
                        name=tool_call["name"],
                        args=tool_call["arguments"],
                        result=json.dumps(tool_result),
                    )

            elif choice.delta.tool_calls:
                for tool_call in choice.delta.tool_calls:
                    id = tool_call.id
                    name = tool_call.function.name
                    arguments = tool_call.function.arguments

                    if id is not None:
                        draft_tool_calls_index += 1
                        draft_tool_calls.append(
                            {"id": id, "name": name, "arguments": ""}
                        )

                    else:
                        draft_tool_calls[draft_tool_calls_index][
                            "arguments"
                        ] += arguments

            else:
                yield "0:{text}\n".format(text=json.dumps(choice.delta.content))

        if chunk.choices == []:
            usage = chunk.usage
            prompt_tokens = usage.prompt_tokens
            completion_tokens = usage.completion_tokens

            yield 'e:{{"finishReason":"{reason}","usage":{{"promptTokens":{prompt},"completionTokens":{completion}}},"isContinued":false}}\n'.format(
                reason="tool-calls" if len(draft_tool_calls) > 0 else "stop",
                prompt=prompt_tokens,
                completion=completion_tokens,
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
            # Only serialize if not already a string
            tool_invocations = (
                message.toolInvocations
                if isinstance(message.toolInvocations[0], str)
                else [t for t in message.toolInvocations]
            )

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
        # async def stream_chat():
        #     current_content = []
        #     tool_invocations = {}  # Use dict to track unique tool calls by ID

        # for chunk in stream_text(openai_messages, protocol):
        #     prefix = chunk[0]
        #     json_str = chunk[2:].strip()

        #     data = None
        #     if is_complete_json(json_str):
        #         data = json.loads(json_str)

        #     if prefix == "0":  # Regular content
        #         if data is None:
        #             current_content.append(
        #                 json_str.replace('{"', "").replace('"}', "")
        #             )
        #         elif isinstance(data, dict) and "content" in data:
        #             current_content.append(data["content"])
        #         yield chunk

        #     elif prefix == "9":  # Tool call partial
        #         if isinstance(data, dict):
        #             tool_invocations[data["toolCallId"]] = {
        #                 "toolCallId": data["toolCallId"],
        #                 "toolName": data["toolName"],
        #                 "args": data["args"],
        #                 "state": "partial-call",
        #                 "result": None,
        #             }
        #         yield chunk

        #     elif prefix == "a":  # Tool call result
        #         if isinstance(data, dict):
        #             tool_invocations[data["toolCallId"]] = {
        #                 "toolCallId": data["toolCallId"],
        #                 "toolName": data["toolName"],
        #                 "args": data["args"],
        #                 "state": "result",
        #                 "result": data["result"],
        #             }
        #         yield chunk

        #     elif prefix == "e":  # End of stream
        #         if isinstance(data, dict):
        #             final_content = "".join(current_content)

        #             # Convert tool invocations dict to list, only keeping final states
        #             final_tool_invocations = list(tool_invocations.values())

        #             message = Message(
        #                 chat_id=chat_id,
        #                 role="assistant",
        #                 content=final_content,
        #                 tool_invocations=final_tool_invocations,
        #                 created_at=datetime.now(timezone.utc),
        #             )
        #             db.add(message)
        #             db.commit()

        #         yield chunk

        return StreamingResponse(
            # stream_chat(),
            stream_text(openai_messages, protocol),
            # media_type="text/event-stream",
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
