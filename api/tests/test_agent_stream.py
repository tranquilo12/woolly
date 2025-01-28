import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy.orm import Session
from api.utils.stream_utils import StreamFormat
from pydantic_ai.messages import TextPart, ToolCallPart, ModelResponse
from api.routers.agents import stream_response, DocumentationRequest
import logging


@pytest.fixture
def mock_request():
    return DocumentationRequest(
        id="test-id",
        messages=[],
        model="gpt-4o-mini",
        agent_id=uuid4(),
        repo_name="test-repo",
        file_paths=["test.py"],
    )


@pytest.fixture
def mock_db():
    return MagicMock(spec=Session)


@pytest.fixture
def mock_client():
    client = AsyncMock(spec=AsyncClient)
    client.timeout = 30.0
    return client


class AsyncIterator:
    def __init__(self, items):
        self.items = items

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self.items:
            raise StopAsyncIteration
        return self.items.pop(0)


@pytest.mark.asyncio
async def test_stream_response_text(mock_request, mock_db, mock_client):
    text_part = TextPart(content="Test message")
    model_response = ModelResponse(parts=[text_part])

    # Create async iterator for stream_structured
    async def mock_stream_structured(*args, **kwargs):
        yield model_response, True

    # Mock the result context manager
    mock_result = AsyncMock()
    mock_result.stream_structured = mock_stream_structured

    # Mock the run_stream context manager
    mock_stream = AsyncMock()
    mock_stream.__aenter__.return_value = mock_result

    with patch("api.routers.agents.get_http_client") as mock_get_client, patch(
        "api.routers.agents.docs_agent.run_stream"
    ) as mock_run:
        mock_get_client.return_value.__aenter__.return_value = mock_client
        mock_run.return_value = mock_stream

        messages = []
        async for message in stream_response(mock_request, mock_db):
            messages.append(message)

        assert len(messages) == 2
        assert messages[0].startswith(StreamFormat.TEXT)
        parsed = json.loads(messages[0].removeprefix(StreamFormat.TEXT))
        assert parsed == "Test message"

        assert messages[1].startswith(StreamFormat.END)
        parsed_end = json.loads(messages[1].removeprefix(StreamFormat.END))
        assert parsed_end["finishReason"] == "stop"


@pytest.mark.asyncio
async def test_stream_response_tool_call(mock_request, mock_db, mock_client):
    # Create a proper ToolCallPart with args that can be serialized
    tool_part = ToolCallPart(
        tool_call_id="test_id", tool_name="test_tool", args={"test": "value"}
    )
    # Mock the args_as_json_str method
    tool_part.args_as_json_str = lambda: json.dumps({"test": "value"})
    model_response = ModelResponse(parts=[tool_part])

    async def mock_stream_structured(*args, **kwargs):
        yield model_response, True

    mock_result = AsyncMock()
    mock_result.stream_structured = mock_stream_structured
    mock_stream = AsyncMock()
    mock_stream.__aenter__.return_value = mock_result

    with patch("api.routers.agents.get_http_client") as mock_get_client, patch(
        "api.routers.agents.docs_agent.run_stream"
    ) as mock_run:
        mock_get_client.return_value.__aenter__.return_value = mock_client
        mock_run.return_value = mock_stream

        messages = []
        async for message in stream_response(mock_request, mock_db):
            messages.append(message)

        assert len(messages) == 2  # Tool call and end message
        assert messages[0].startswith(StreamFormat.TOOL_PARTIAL)
        parsed = json.loads(messages[0].removeprefix(StreamFormat.TOOL_PARTIAL))
        assert parsed["toolCallId"] == "test_id"
        assert parsed["toolName"] == "test_tool"
        if isinstance(parsed["args"], str):
            assert parsed["args"] == '{"test": "value"}'
        else:
            assert parsed["args"] == {"test": "value"}
        assert parsed["state"] == "partial-call"

        assert messages[1].startswith(StreamFormat.END)
        parsed_end = json.loads(messages[1].removeprefix(StreamFormat.END))
        assert parsed_end["finishReason"] == "stop"


@pytest.mark.asyncio
async def test_stream_response_integration(caplog):
    # Set logging level to see output
    caplog.set_level(logging.INFO)

    request = DocumentationRequest(
        id="test-id",
        messages=[{"role": "user", "content": "Generate documentation for test repo"}],
        model="gpt-4o-mini",
        agent_id=uuid4(),
        repo_name="vercel-chat-template",
        file_paths=[],
    )

    db = Session()

    messages = []
    async for message in stream_response(request, db):
        messages.append(message)

        if message.startswith(StreamFormat.TOOL_PARTIAL):
            parsed = json.loads(message.removeprefix(StreamFormat.TOOL_PARTIAL))
            logging.info(f"Partial call: {parsed}")  # Using logging instead of print
            assert "toolCallId" in parsed
            assert "toolName" in parsed
            assert "args" in parsed
            assert parsed["state"] == "partial-call"

        elif message.startswith(StreamFormat.TOOL_RESULT):
            parsed = json.loads(message.removeprefix(StreamFormat.TOOL_RESULT))
            logging.info(f"Tool result: {parsed}")  # Using logging instead of print
            assert "toolCallId" in parsed
            assert "toolName" in parsed
            assert "result" in parsed
            assert parsed["state"] == "result"

        elif message.startswith(StreamFormat.END):
            parsed = json.loads(message.removeprefix(StreamFormat.END))
            logging.info(f"End message: {parsed}")  # Using logging instead of print
            assert "finishReason" in parsed
