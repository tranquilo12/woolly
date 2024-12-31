import os
import json
from typing import List, Optional
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Depends, HTTPException, Request, Body, Header
from fastapi.responses import StreamingResponse
from openai import OpenAI
from .utils.prompt import ClientMessage, convert_to_openai_messages
from .utils.tools import execute_python_code
from .utils.models import (
    Chat,
    Message,
    User,
)
import uuid
from sqlalchemy.orm import Session
from .utils.database import get_db
from datetime import datetime, timezone
from pydantic import ValidationError
import base64
import jwt
from jwt.exceptions import JWTException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import re


load_dotenv(".env.local")

app = FastAPI()

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)


# Custom security scheme that's more lenient with token format
class CustomHTTPBearer(HTTPBearer):
    async def __call__(
        self, request: Request
    ) -> Optional[HTTPAuthorizationCredentials]:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Missing authorization header")

        # Extract token regardless of format
        token_match = re.match(r"Bearer\s+(.+)", auth_header, re.IGNORECASE)
        if not token_match:
            raise HTTPException(
                status_code=401, detail="Invalid authorization header format"
            )

        token = token_match.group(1)
        return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


security = CustomHTTPBearer()


# Update header validation
async def validate_headers(
    authorization: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    return {"token": authorization.credentials}


class Request(BaseModel):
    messages: List[ClientMessage]


class ChatTitleUpdate(BaseModel):
    title: str


class MessageCreate(BaseModel):
    role: str
    content: str
    toolInvocations: Optional[List[dict]] = None


class ChatCreateRequest(BaseModel):
    userId: str
    messages: List[dict] = []


class UserSync(BaseModel):
    azure_id: str
    email: str
    name: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None


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
    )

    return stream


def stream_text(messages: List[ChatCompletionMessageParam], protocol: str = "data"):
    try:
        stream = do_stream(messages)
        current_tool_call = None
        current_args_buffer = []

        def execute_tool_call(tool_call, args_str):
            """Helper function to execute a complete tool call"""
            try:
                args = json.loads(args_str)
                if not isinstance(args, dict):
                    raise ValueError("Arguments must be a JSON object")

                result = available_tools[tool_call.function.name](**args)
                return {
                    "type": "tool_result",
                    "data": {"tool_call_id": tool_call.id, "result": result},
                }
            except json.JSONDecodeError as e:
                print(f"JSON parsing error: {e}")
                return {
                    "type": "error",
                    "data": f"Failed to parse tool arguments: {str(e)}",
                }
            except Exception as e:
                print(f"Tool execution error: {e}")
                return {"type": "error", "data": f"Tool execution failed: {str(e)}"}

        for chunk in stream:
            if not chunk.choices:
                continue

            delta = chunk.choices[0].delta

            # Handle tool calls
            if delta.tool_calls:
                for tool_call in delta.tool_calls:
                    # Initialize tool call if not already set
                    if not current_tool_call:
                        current_tool_call = tool_call
                        current_args_buffer = []
                    if tool_call.function and tool_call.function.arguments:
                        current_args_buffer.append(tool_call.function.arguments)

                    elif tool_call.function and tool_call.function.arguments:
                        current_args_buffer.append(tool_call.function.arguments)

                    # Try to process complete arguments
                    if current_tool_call and current_args_buffer:
                        try:
                            complete_args = "".join(current_args_buffer)
                            # Validate JSON completeness
                            json.loads(complete_args)

                            # Only emit tool call when we have complete valid JSON
                            yield f'data: {{"type":"tool_call","data":{{"id":"{current_tool_call.id}","function":{{"name":"{current_tool_call.function.name}","arguments":{complete_args}}},"state":"complete"}}}}\n\n'

                            # Execute tool call
                            result = execute_tool_call(current_tool_call, complete_args)
                            yield f"data: {json.dumps(result)}\n\n"

                            # Reset state
                            current_tool_call = None
                            current_args_buffer = []

                        except json.JSONDecodeError:
                            # Arguments still incomplete, continue accumulating
                            pass

            # Handle regular content
            if delta.content:
                yield f"data: {json.dumps({
                    'type': 'text',
                    'data': delta.content
                })}\n\n"

        # Handle any remaining complete tool call
        if current_tool_call and current_args_buffer:
            complete_args = "".join(current_args_buffer).strip()
            try:
                # Validate final JSON
                json.loads(complete_args)
                result = execute_tool_call(current_tool_call, complete_args)
                yield f"data: {json.dumps(result)}\n\n"
            except json.JSONDecodeError:
                print("Discarding incomplete final tool call")

        # Signal end of stream
        yield f"data: {json.dumps({
            'type': 'done',
            'data': None
        })}\n\n"

    except Exception as e:
        print(f"Error in stream_text: {e}")
        yield f"data: {json.dumps({
            'type': 'error',
            'data': str(e)
        })}\n\n"


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
        raise HTTPException(status_code=500, detail=str(e))


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
    chat_id: uuid.UUID,
    title_update: ChatTitleUpdate,
    headers: dict = Depends(validate_headers),
    db: Session = Depends(get_db),
):
    """Update chat title"""
    try:
        # Access validated token
        token = headers["token"]

        # Your existing title update logic here

        return {"success": True}
    except Exception as e:
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
    try:
        # Add debug logging
        print("Received request body:", request)

        if not request.messages:
            raise HTTPException(
                status_code=422, detail="No messages provided in request"
            )

        openai_messages = convert_to_openai_messages(request.messages)
        current_content = []
        tool_invocations = []

        async def stream_chat(openai_messages, protocol):
            try:
                for chunk in stream_text(openai_messages, protocol):
                    if isinstance(chunk, str):
                        if chunk.startswith("data: "):
                            # Remove "data: " prefix
                            data = json.loads(chunk[6:].strip())
                            if data["type"] == "tool_call":
                                tool_invocations.append(
                                    {
                                        "toolCallId": data["data"]["id"],
                                        "toolName": data["data"]["function"]["name"],
                                        "args": json.dumps(
                                            data["data"]["function"]["arguments"]
                                        ),
                                        "state": "partial-call",
                                    }
                                )
                            elif data["type"] == "tool_result":
                                for tool in tool_invocations:
                                    if (
                                        tool["toolCallId"]
                                        == data["data"]["tool_call_id"]
                                    ):
                                        tool["result"] = data["data"]["result"]
                                        tool["state"] = "result"
                            elif data["type"] == "text":
                                current_content.append(data["data"])
                            yield chunk  # Pass through the formatted chunk
                        elif chunk.startswith("text: "):
                            content = chunk[6:].strip()  # Remove "text: " prefix
                            current_content.append(content)
                            yield chunk
                        elif chunk.startswith("error: "):
                            print(f"Error in stream: {chunk}")
                            yield chunk
                        elif chunk.startswith("done: "):
                            yield chunk
                    else:
                        # Handle any non-string chunks (shouldn't occur with new protocol)
                        print(f"Unexpected chunk type: {type(chunk)}")

                # Save the user message
                user_message = Message(
                    chat_id=chat_id,
                    role="user",
                    content=request.messages[-1].content,
                )
                db.add(user_message)
                db.commit()

                # After streaming ends, save the complete assistant message
                final_message = Message(
                    chat_id=chat_id,
                    role="assistant",
                    content="".join(current_content),
                    tool_invocations=tool_invocations,
                )
                db.add(final_message)
                db.commit()

            except Exception as e:
                print(f"Error in stream_chat: {e}")
                raise

        return StreamingResponse(
            stream_chat(openai_messages, protocol),
            headers={"x-vercel-ai-data-stream": "v1"},
            media_type="text/event-stream",
        )
    except ValidationError as e:
        print("Validation error:", str(e))
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print("Unexpected error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/users/sync")
async def sync_user(user_data: UserSync, db: Session = Depends(get_db)):
    """Create or update user from Azure AD login"""
    print(f"User data: {user_data}")
    print(f"User data type: {type(user_data)}")
    try:
        # Try to find existing user
        user = db.query(User).filter(User.azure_id == user_data.azure_id).first()

        if user:
            # Update existing user
            user.email = user_data.email
            user.name = user_data.name
            user.access_token = user_data.access_token
            user.refresh_token = user_data.refresh_token
            if user_data.expires_at:
                user.token_expires_at = user_data.expires_at
        else:
            print(f"All user data: {user_data}")

            # Create new user
            user = User(
                azure_id=user_data.azure_id,
                email=user_data.email,
                name=user_data.name,
                access_token=user_data.access_token,
                refresh_token=user_data.refresh_token,
                token_expires_at=user_data.expires_at,
            )
            db.add(user)

        db.commit()
        return {"id": str(user.id), "email": user.email}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to sync user: {str(e)}")
