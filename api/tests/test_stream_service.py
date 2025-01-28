import pytest
from unittest.mock import Mock, patch
from openai.types.chat.chat_completion import CompletionUsage
from api.services.stream_service import stream_text
from api.utils.stream_utils import StreamFormat
import json
from typing import List, Optional


@pytest.fixture
def mock_openai_stream():
    class MockChoice:
        def __init__(self, content=None, tool_calls=None, finish_reason=None):
            self.delta = Mock(content=content, tool_calls=tool_calls)
            self.finish_reason = finish_reason

    class MockChunk:
        def __init__(self, choices, usage: Optional[CompletionUsage] = None):
            self.choices = choices
            self.usage = usage

    return MockChunk


@pytest.mark.asyncio
async def test_stream_text_content(mock_openai_stream):
    with patch("api.services.stream_service.do_stream") as mock_do_stream:
        content = "Test message"
        mock_chunk = mock_openai_stream(
            choices=[
                Mock(delta=Mock(content=content, tool_calls=None), finish_reason=None)
            ]
        )
        mock_do_stream.return_value = [mock_chunk]

        messages = [{"role": "user", "content": "test"}]
        stream = stream_text(messages)
        first_message = next(stream)

        assert first_message.startswith(StreamFormat.TEXT)
        parsed = json.loads(first_message.removeprefix(StreamFormat.TEXT))
        assert parsed == content


@pytest.mark.asyncio
async def test_stream_text_tool_calls(mock_openai_stream):
    with patch("api.services.stream_service.do_stream") as mock_do_stream:
        # Mock tool call initialization with concrete values
        tool_call = Mock(
            id="call_123",
            function=Mock(
                name="execute_python_code",
                arguments='{"code": "print(\'hello\')", "output_format": "text"}',
            ),
        )

        # Configure mock to return concrete values
        tool_call.id = "call_123"  # Ensure id is a string
        tool_call.function.name = "execute_python_code"  # Ensure name is a string
        tool_call.function.arguments = '{"code": "print(\'hello\')", "output_format": "text"}'  # Ensure arguments is a string

        # Create sequence of chunks to simulate streaming
        chunks = [
            mock_openai_stream(
                choices=[
                    Mock(
                        delta=Mock(content=None, tool_calls=[tool_call]),
                        finish_reason=None,
                    )
                ]
            ),
            # Chunk with tool execution finish
            mock_openai_stream(
                choices=[
                    Mock(
                        delta=Mock(content=None, tool_calls=None),
                        finish_reason="tool_calls",
                    )
                ]
            ),
        ]

        mock_do_stream.return_value = chunks

        messages = [{"role": "user", "content": "test"}]
        stream = stream_text(messages)

        # Verify tool call partial
        first_message = next(stream)
        assert first_message.startswith(StreamFormat.TOOL_PARTIAL)
        parsed = json.loads(first_message.removeprefix(StreamFormat.TOOL_PARTIAL))
        assert parsed["toolCallId"] == "call_123"
        assert parsed["toolName"] == "execute_python_code"
        assert parsed["state"] == "partial-call"

        # Verify tool result
        second_message = next(stream)
        assert second_message.startswith(StreamFormat.TOOL_RESULT)
        parsed = json.loads(second_message.removeprefix(StreamFormat.TOOL_RESULT))
        assert parsed["toolCallId"] == "call_123"
        assert parsed["toolName"] == "execute_python_code"
        assert parsed["state"] == "result"
        assert "result" in parsed


@pytest.mark.asyncio
async def test_stream_text_end_message(mock_openai_stream):
    with patch("api.services.stream_service.do_stream") as mock_do_stream:
        usage = CompletionUsage(prompt_tokens=10, completion_tokens=20, total_tokens=30)

        mock_chunk = mock_openai_stream(choices=[], usage=usage)

        mock_do_stream.return_value = [mock_chunk]

        messages = [{"role": "user", "content": "test"}]
        stream = stream_text(messages)

        message = next(stream)
        assert message.startswith(StreamFormat.END)
        parsed = json.loads(message.removeprefix(StreamFormat.END))
        assert parsed["finishReason"] == "stop"
        assert parsed["usage"]["promptTokens"] == 10
        assert parsed["usage"]["completionTokens"] == 20
        assert parsed["usage"]["totalTokens"] == 30
