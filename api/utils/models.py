from pydantic import BaseModel
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .database import Base


# region OpenAI Streaming Response Models


class Usage(BaseModel):
    promptTokens: int
    completionTokens: int


class EndOfStreamMessage(BaseModel):
    finishReason: str
    usage: Usage
    isContinued: bool = False


class ToolCallInstruction(BaseModel):
    toolCallId: str
    toolName: str
    args: dict


class ToolCallResult(BaseModel):
    toolCallId: str
    toolName: str
    args: dict
    result: dict | None = None


def build_end_of_stream_message(
    finish_reason: str,
    prompt_tokens: int,
    completion_tokens: int,
    is_continued: bool = False,
) -> str:
    """
    Return a serialized JSON string matching your 'e:...' format.
    """
    obj = EndOfStreamMessage(
        finishReason=finish_reason,
        usage=Usage(promptTokens=prompt_tokens, completionTokens=completion_tokens),
        isContinued=is_continued,
    )
    return f"e:{obj.model_dump_json()}\n"


def build_tool_call_instruction(tool_call_id: str, tool_name: str, args: dict) -> str:
    """
    Return a serialized JSON string matching your '9:...' format.
    """
    obj = ToolCallInstruction(
        toolCallId=tool_call_id,
        toolName=tool_name,
        args=args,
    )
    return f"9:{obj.model_dump_json()}\n"


def build_tool_call_result(
    tool_call_id: str, tool_name: str, args: dict, result: dict
) -> str:
    """
    Return a serialized JSON string matching your 'a:...' format.
    """
    obj = ToolCallResult(
        toolCallId=tool_call_id,
        toolName=tool_name,
        args=args,
        result=result,
    )
    return f"a:{obj.model_dump_json()}\n"


# endregion

# region Database Models


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chats = relationship("Chat", back_populates="user")


class Chat(Base):
    __tablename__ = "chats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title = Column(String, default="New Chat")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="chats")
    messages = relationship("Message", back_populates="chat")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id"))
    role = Column(String)
    content = Column(Text)
    tool_invocations = Column(Text, nullable=True)  # Store as JSON string
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chat = relationship("Chat", back_populates="messages")


# endregion
