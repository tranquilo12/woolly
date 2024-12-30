import json
from enum import Enum
from openai.types.chat.chat_completion_message_param import ChatCompletionMessageParam
from pydantic import BaseModel
from typing import List, Optional, Any
from .attachment import ClientAttachment


class ToolInvocationState(str, Enum):
    CALL = "call"
    PARTIAL_CALL = "partial-call"
    RESULT = "result"


class ToolInvocation(BaseModel):
    state: ToolInvocationState
    toolCallId: str
    toolName: str
    args: Any
    result: Any


class ClientMessage(BaseModel):
    role: str
    content: str
    experimental_attachments: Optional[List[ClientAttachment]] = None
    toolInvocations: Optional[List[ToolInvocation]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "role": "user",
                "content": "Hello, how are you?",
            }
        }


class Request(BaseModel):
    messages: List[ClientMessage]

    class Config:
        json_schema_extra = {
            "example": {
                "messages": [{"role": "user", "content": "Hello, how are you?"}]
            }
        }


def convert_to_openai_messages(
    messages: List[ClientMessage],
) -> List[ChatCompletionMessageParam]:
    """
    Convert a list of ClientMessages to a list of OpenAI messages
    ensuring no duplicate tool messages for the same call ID.
    """
    openai_messages = []
    seen_tool_call_ids = set()  # Track which tool calls we've already processed

    for message in messages:
        # Basic text content
        parts = [{"type": "text", "text": message.content}]

        # Handle attachments
        if message.experimental_attachments:
            for attachment in message.experimental_attachments:
                if attachment.contentType.startswith("image"):
                    parts.append(
                        {"type": "image_url", "image_url": {"url": attachment.url}}
                    )
                elif attachment.contentType.startswith("text"):
                    parts.append({"type": "text", "text": attachment.url})

        # For assistant messages with tool invocations
        tool_calls = []
        if message.role == "assistant" and message.toolInvocations:
            # Group tool invocations by their ID to prevent duplicates
            tool_invocations_by_id = {}
            for invocation in message.toolInvocations:
                if invocation.toolCallId not in tool_invocations_by_id:
                    tool_invocations_by_id[invocation.toolCallId] = invocation

            # Create tool calls array from unique invocations
            for invocation in tool_invocations_by_id.values():
                tool_calls.append(
                    {
                        "id": invocation.toolCallId,
                        "type": "function",
                        "function": {
                            "name": invocation.toolName,
                            "arguments": (
                                json.dumps(invocation.args) if invocation.args else ""
                            ),
                        },
                    }
                )

        # Add the main message
        openai_messages.append(
            {
                "role": message.role,
                "content": parts,
                "tool_calls": tool_calls if tool_calls else None,
            }
        )

        # Add tool results (only for unique tool calls we haven't seen before)
        if message.role == "assistant" and message.toolInvocations:
            for invocation in message.toolInvocations:
                if (
                    invocation.state == "result"
                    and invocation.result is not None
                    and invocation.toolCallId not in seen_tool_call_ids
                ):
                    seen_tool_call_ids.add(invocation.toolCallId)
                    openai_messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": invocation.toolCallId,
                            "content": json.dumps(invocation.result),
                        }
                    )

    return openai_messages
