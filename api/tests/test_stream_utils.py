import json
import pytest
from api.utils.stream_utils import (
    format_content,
    format_tool_partial,
    format_tool_result,
    format_end_message,
    StreamFormat,
)


def test_format_content():
    content = "Hello, world!"
    formatted = format_content(content)
    parsed = json.loads(formatted.removeprefix(StreamFormat.TEXT))
    assert formatted.startswith(StreamFormat.TEXT)
    assert parsed == content
    assert formatted.endswith("\n")


def test_format_tool_partial():
    tool_data = {
        "tool_call_id": "123",
        "tool_name": "test_tool",
        "args": {"param": "value"},
    }
    formatted = format_tool_partial(**tool_data)
    parsed = json.loads(formatted.removeprefix(StreamFormat.TOOL_PARTIAL))
    assert formatted.startswith(StreamFormat.TOOL_PARTIAL)
    assert parsed["toolCallId"] == tool_data["tool_call_id"]
    assert parsed["toolName"] == tool_data["tool_name"]
    assert parsed["args"] == tool_data["args"]
    assert parsed["state"] == "partial-call"
    assert formatted.endswith("\n")


def test_format_tool_result():
    tool_data = {
        "tool_call_id": "123",
        "tool_name": "test_tool",
        "args": {"param": "value"},
        "result": {"output": "success"},
    }
    formatted = format_tool_result(**tool_data)
    parsed = json.loads(formatted.removeprefix(StreamFormat.TOOL_RESULT))
    assert formatted.startswith(StreamFormat.TOOL_RESULT)
    assert parsed["toolCallId"] == tool_data["tool_call_id"]
    assert parsed["toolName"] == tool_data["tool_name"]
    assert parsed["args"] == tool_data["args"]
    assert parsed["result"] == tool_data["result"]
    assert parsed["state"] == "result"
    assert formatted.endswith("\n")


def test_format_end_message():
    end_data = {
        "finish_reason": "stop",
        "prompt_tokens": 10,
        "completion_tokens": 20,
        "is_continued": False,
    }
    formatted = format_end_message(**end_data)
    parsed = json.loads(formatted.removeprefix(StreamFormat.END))
    assert formatted.startswith(StreamFormat.END)
    assert parsed["finishReason"] == end_data["finish_reason"]
    assert parsed["usage"]["promptTokens"] == end_data["prompt_tokens"]
    assert parsed["usage"]["completionTokens"] == end_data["completion_tokens"]
    assert (
        parsed["usage"]["totalTokens"]
        == end_data["prompt_tokens"] + end_data["completion_tokens"]
    )
    assert parsed["isContinued"] == end_data["is_continued"]
    assert formatted.endswith("\n")
