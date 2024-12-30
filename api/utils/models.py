from typing import Literal, Dict, Any
from pydantic import BaseModel
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, func, JSON
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
    state: Literal["call", "partial-call"] = "call"


class ToolCallPartial(BaseModel):
    toolCallId: str
    toolName: str
    state: Literal["partial-call"]
    args: dict


class ToolCallResult(BaseModel):
    toolCallId: str
    toolName: str
    state: Literal["result"]
    args: dict
    result: dict | None = None


def build_tool_call_partial(tool_call_id: str, tool_name: str, args: dict) -> str:
    """
    Return a serialized JSON string for partial tool calls in the '9:...' format.
    Similar to build_tool_call_instruction but with state='partial-call'
    """
    obj = ToolCallInstruction(
        toolCallId=tool_call_id,
        toolName=tool_name,
        args=args,
        state="partial-call",  # Explicitly set the state for partial calls
    )
    return f"9:{obj.model_dump_json()}\n"


def build_tool_call_result(
    tool_call_id: str, tool_name: str, args: dict, result: dict
) -> str:
    """
    Return a serialized JSON string matching your 'a:...' format.
    """
    obj = ToolCallResult(
        toolCallId=tool_call_id, toolName=tool_name, args=args, result=result
    )
    return f"a:{obj.model_dump_json()}\n"


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
    tool_invocations = Column(JSON, default=list)  # Store as JSON array
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chat = relationship("Chat", back_populates="messages")

    def update_tool_invocations(self, tool_invocation: Dict[str, Any]) -> None:
        """Update or append a tool invocation to the message."""
        current_invocations = self.tool_invocations or []

        # Find existing invocation with same ID
        for i, invocation in enumerate(current_invocations):
            if invocation["toolCallId"] == tool_invocation["toolCallId"]:
                current_invocations[i] = tool_invocation
                break
        else:
            # If not found, append new invocation
            current_invocations.append(tool_invocation)

        self.tool_invocations = current_invocations


# endregion
