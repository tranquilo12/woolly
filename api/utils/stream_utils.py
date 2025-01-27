from typing import Any, Dict, Optional, ClassVar
import json
from pydantic import BaseModel


class StreamFormat(BaseModel):
    """Constants for stream format prefixes"""

    TEXT: ClassVar[str] = "0:"
    TOOL_PARTIAL: ClassVar[str] = "9:"
    TOOL_RESULT: ClassVar[str] = "a:"
    END: ClassVar[str] = "e:"


def format_content(content: str) -> str:
    """Format regular content messages"""
    return f"{StreamFormat.TEXT}{json.dumps(content)}\n"


def format_tool_partial(tool_call_id: str, tool_name: str, args: Dict[str, Any]) -> str:
    """Format partial tool call messages"""
    obj = {
        "toolCallId": tool_call_id,
        "toolName": tool_name,
        "args": args,
        "state": "partial-call",
    }
    return f"{StreamFormat.TOOL_PARTIAL}{json.dumps(obj)}\n"


def format_tool_result(
    tool_call_id: str,
    tool_name: str,
    args: Dict[str, Any],
    result: Optional[Dict[str, Any]],
) -> str:
    """Format tool result messages"""
    obj = {
        "toolCallId": tool_call_id,
        "toolName": tool_name,
        "args": args,
        "state": "result",
        "result": result,
    }
    return f"{StreamFormat.TOOL_RESULT}{json.dumps(obj)}\n"


def format_end_message(
    finish_reason: str = "stop",
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    is_continued: bool = False,
) -> str:
    """Format end of stream messages"""
    obj = {
        "finishReason": finish_reason,
        "usage": {
            "promptTokens": prompt_tokens,
            "completionTokens": completion_tokens,
            "totalTokens": prompt_tokens + completion_tokens,
        },
        "isContinued": is_continued,
    }
    return f"{StreamFormat.END}{json.dumps(obj)}\n"
