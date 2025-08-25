from datetime import datetime, timezone
import json
from typing import Literal, Dict, Any, List, Optional
from pydantic import BaseModel
from sqlalchemy import (
    Column,
    String,
    DateTime,
    ForeignKey,
    Text,
    func,
    JSON,
    Boolean,
    Integer,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .database import Base


# region AI SDK V5 Streaming Response Models


class Usage(BaseModel):
    promptTokens: int
    completionTokens: int
    totalTokens: int


class EndOfStreamMessage(BaseModel):
    finishReason: str
    usage: Usage
    isContinued: bool = False


class ToolCallPartial(BaseModel):
    toolCallId: str
    toolName: str
    state: Literal["partial-call"]
    args: dict
    result: None = None  # Always None for partial calls


class ToolCallResult(BaseModel):
    toolCallId: str
    toolName: str
    state: Literal["result"]
    args: dict
    result: dict | None = None


def build_tool_call_partial(tool_call_id: str, tool_name: str, args: dict) -> str:
    """
    Return a serialized JSON string for partial tool calls in AI SDK V5 format.
    V5 uses the '9:...' format for tool call streaming.

    Args:
        tool_call_id: Unique identifier for the tool call
        tool_name: Name of the tool being called
        args: Arguments passed to the tool

    Returns:
        V5 formatted string: "9:{...}\n"
    """
    obj = {
        "toolCallId": tool_call_id,
        "toolName": tool_name,
        "args": args,
        "state": "partial-call",
    }
    res = json.dumps(obj, ensure_ascii=False)
    return f"9:{res}\n"


def build_tool_call_result(
    tool_call_id: str, tool_name: str, args: dict, result: dict | None
) -> str:
    """
    Return a serialized JSON string for tool call results in AI SDK V5 format.
    V5 uses the 'a:...' format for tool result streaming.

    Args:
        tool_call_id: Unique identifier for the tool call
        tool_name: Name of the tool that was called
        args: Arguments that were passed to the tool
        result: Result returned by the tool execution

    Returns:
        V5 formatted string: "a:{...}\n"
    """
    obj = {
        "toolCallId": tool_call_id,
        "toolName": tool_name,
        "args": args,
        "state": "result",
        "result": result,
    }
    res = json.dumps(obj, ensure_ascii=False)
    return f"a:{res}\n"


def build_end_of_stream_message(
    finish_reason: str,
    prompt_tokens: int,
    completion_tokens: int,
    is_continued: bool = False,
) -> str:
    """
    Return a serialized JSON string for end-of-stream messages in AI SDK V5 format.
    V5 uses the 'e:...' format and requires totalTokens in usage statistics.

    Args:
        finish_reason: Reason for stream completion ("stop", "error", "length", etc.)
        prompt_tokens: Number of tokens in the input prompt
        completion_tokens: Number of tokens in the generated completion
        is_continued: Whether the stream will continue (for multi-part responses)

    Returns:
        V5 formatted string: "e:{...}\n"
    """
    total_tokens = prompt_tokens + completion_tokens
    obj = EndOfStreamMessage(
        finishReason=finish_reason,
        usage=Usage(
            promptTokens=prompt_tokens,
            completionTokens=completion_tokens,
            totalTokens=total_tokens,
        ),
        isContinued=is_continued,
    )
    res = obj.model_dump_json()
    return f"e:{res}\n"


def build_text_stream(content: str) -> str:
    """
    Return a serialized JSON string for text content in AI SDK V5 format.
    V5 uses the '0:...' format for text content streaming with proper message structure.

    Args:
        content: Text content to stream to the client

    Returns:
        V5 formatted string: '0:{"type":"text","text":"content"}\n'
    """
    text_chunk = {"type": "text", "text": content}
    return f"0:{json.dumps(text_chunk, ensure_ascii=False)}\n"


def build_message_start(message_id: str, role: str = "assistant") -> str:
    """
    Return a serialized JSON string for starting a new message in AI SDK V5 format.
    V5 uses the '1:...' format to begin a message stream.

    Args:
        message_id: Unique identifier for the message
        role: Role of the message sender ("user", "assistant", "system")

    Returns:
        V5 formatted string: '1:{"id":"msg-123","role":"assistant","parts":[]}\n'
    """
    message_start = {"id": message_id, "role": role, "parts": []}
    return f"1:{json.dumps(message_start, ensure_ascii=False)}\n"


def build_message_end(
    message_id: str, role: str = "assistant", content: str = ""
) -> str:
    """
    Return a serialized JSON string for ending a message in AI SDK V5 format.
    V5 uses the '2:...' format to complete a message with full content.

    Args:
        message_id: Unique identifier for the message
        role: Role of the message sender ("user", "assistant", "system")
        content: Complete accumulated content of the message

    Returns:
        V5 formatted string: '2:{"id":"msg-123","role":"assistant","parts":[{"type":"text","text":"content"}]}\n'
    """
    parts = []
    if content.strip():
        parts.append({"type": "text", "text": content})

    message_end = {"id": message_id, "role": role, "parts": parts}
    return f"2:{json.dumps(message_end, ensure_ascii=False)}\n"


def is_complete_json(json_str: str) -> bool:
    """
    Check if a streaming JSON string appears to be complete and valid.
    Attempts to parse the JSON silently to validate proper structure.
    """
    try:
        # Attempt to parse the JSON
        parsed = json.loads(json_str)
        # Ensure it's a dictionary/object
        return isinstance(parsed, dict)
    except json.JSONDecodeError:
        return False


# endregion

# region Database Models


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chats = relationship("Chat", back_populates="user")


class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True)
    description = Column(Text)
    system_prompt = Column(Text)
    tools = Column(JSON, default=list)  # List of tool names this agent can use
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    repository = Column(String, nullable=True)
    # Add relationship to chats
    chats = relationship("Chat", back_populates="agent")


class Chat(Base):
    __tablename__ = "chats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="chats")
    agent = relationship("Agent", back_populates="chats")
    messages = relationship("Message", back_populates="chat")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id"))
    role = Column(String)
    content = Column(Text)
    model = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    tool_invocations = Column(JSON, nullable=True)
    agent_id = Column(UUID(as_uuid=True), nullable=True)
    repository = Column(String, nullable=True)
    message_type = Column(String, nullable=True)
    pipeline_id = Column(
        String, nullable=True
    )  # New field for pipeline/strategy identification

    # New fields for agent message grouping
    iteration_index: Optional[int] = Column(Integer)
    step_index: Optional[int] = Column(Integer)
    step_title: Optional[str] = Column(String)

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

# region Pydantic Models for Agents


class AgentCreate(BaseModel):
    name: str
    description: str
    system_prompt: str
    tools: List[str] = []
    repository: Optional[str] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    tools: Optional[List[str]] = None
    is_active: Optional[bool] = None


class AgentResponse(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
    tools: List[str]
    created_at: datetime
    is_active: bool
    repository: Optional[str] = None

    class Config:
        from_attributes = True


# endregion
