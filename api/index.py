import asyncio
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from api.services.stream_service import stream_text
from .utils.prompt import (
    convert_to_openai_messages,
)
from .utils.models import (
    ChatTitleUpdate,
    MessageCreate,
    RequestFromFrontend,
    MessageEdit,
)
from .utils.models import (
    Chat,
    Message,
    Agent,
)
import uuid
from sqlalchemy.orm import Session
from .utils.database import get_db
from datetime import datetime, timezone, timedelta
from .routers import agents  # Add this import


load_dotenv(".env.local")

app = FastAPI()

# # Add CORS middleware configuration
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # In production, replace with your frontend URL
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# Include the agents router
app.include_router(agents.router, prefix="/api")  # Add this line


# region Chat CRUD Operations
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


# endregion


# region Chat Title Operations
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


# endregion


# region Message Operations
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
            "prompt_tokens": message.prompt_tokens,
            "completion_tokens": message.completion_tokens,
            "total_tokens": message.total_tokens,
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
            tool_invocations = [
                t if isinstance(t, dict) else t.dict() for t in message.toolInvocations
            ]

        db_message = Message(
            chat_id=chat_id,
            role=message.role,
            content=message.content,
            tool_invocations=tool_invocations,
            created_at=datetime.now(timezone.utc),
            prompt_tokens=message.prompt_tokens,
            completion_tokens=message.completion_tokens,
            total_tokens=message.total_tokens,
        )

        db.add(db_message)
        db.commit()
        db.refresh(db_message)

        return {"success": True, "message_id": str(db_message.id)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save message: {str(e)}")


# endregion


# region Chat Interaction Endpoints
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


# endregion


# region Legacy Endpoint


# Legacy Endpoint (Consider deprecating)
@app.post("/api/chat")
async def handle_chat_legacy(
    request: RequestFromFrontend, protocol: str = Query("data")
):
    """Legacy endpoint maintained for backward compatibility"""
    messages = request.messages
    openai_messages = convert_to_openai_messages(messages)

    return StreamingResponse(
        stream_text(openai_messages, protocol),
        headers={"x-vercel-ai-data-stream": "v1"},
    )


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


# endregion
