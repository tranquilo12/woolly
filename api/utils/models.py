import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, UUID4
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .database import Base
from .prompt import Attachment
from .tools import execute_python_code

# region OpenAI Streaming Response Models


class Usage(BaseModel):
    promptTokens: int
    completionTokens: int


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


def build_tool_call_partial(tool_call_id: str, tool_name: str, args: dict | str) -> str:
    """
    Return a serialized JSON string for partial tool calls in the '9:...' format.
    Args can be either a dict or a partial JSON string.
    """
    obj = {
        "toolCallId": tool_call_id,
        "toolName": tool_name,
        "args": args if isinstance(args, dict) else {"partial_content": args},
        "state": "partial-call",
    }
    res = json.dumps(obj)
    return f"9:{res}\n\n"


def build_tool_call_result(
    tool_call_id: str, tool_name: str, args: dict, result: dict | None
) -> str:
    """
    Return a serialized JSON string for tool call results in the 'a:...' format.
    """
    obj = {
        "toolCallId": tool_call_id,
        "toolName": tool_name,
        "args": args,
        "state": "result",
        "result": result,
    }
    res = json.dumps(obj)
    return f"a:{res}\n\n"


def build_end_of_stream_message(
    finish_reason: str,
    prompt_tokens: int,
    completion_tokens: int,
    is_continued: bool = False,
) -> str:
    """
    Return a serialized JSON string for end-of-stream messages in the 'e:...' format.
    """
    obj = EndOfStreamMessage(
        finishReason=finish_reason,
        usage=Usage(promptTokens=prompt_tokens, completionTokens=completion_tokens),
        isContinued=is_continued,
    )
    res = obj.model_dump_json()
    return f"e:{res}\n\n"


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

    chats = relationship("Chat", back_populates="agent")
    messages = relationship("Message", back_populates="agent")


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
    tool_invocations = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    model = Column(String, nullable=True, default="gpt-4o")
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)

    chat = relationship("Chat", back_populates="messages")
    agent = relationship("Agent", back_populates="messages")

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


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    tools: Optional[List[str]] = None
    is_active: Optional[bool] = None


class AgentResponse(BaseModel):
    id: UUID4
    name: str
    description: str
    system_prompt: str
    tools: List[str]
    created_at: datetime
    is_active: bool

    class Config:
        arbitrary_types_allowed = True


# endregion

# region Chat types


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
    model: Optional[str] = None
    toolInvocations: Optional[List[ToolInvocation]] = None
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

# endregion
