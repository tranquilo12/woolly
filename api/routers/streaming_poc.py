"""
Phase 5 PoC: Streaming Endpoint Demo
===================================

Minimal FastAPI route demonstrating Vercel AI SDK v4 compatible streaming.
This PoC validates the event format and SSE transport before implementing
the full Pydantic-AI integration.
"""

import json
import asyncio
from typing import AsyncGenerator
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/streaming", tags=["streaming-poc"])


class StreamRequest(BaseModel):
    prompt: str


def sse_event(event_type: str, data: dict) -> str:
    """Format data as Server-Sent Event compatible with AI SDK V5."""
    event_data = {"type": event_type, **data}
    return f"data: {json.dumps(event_data)}\n\n"


async def mock_agent_stream(prompt: str) -> AsyncGenerator[str, None]:
    """
    Mock agent streaming that demonstrates the event sequence:
    1. Tool call events
    2. Tool result events
    3. Text streaming events
    4. Done event
    """

    # Simulate initial tool call
    yield sse_event(
        "toolCall",
        {
            "id": "tool_call_1",
            "name": "search_code",
            "args": {"query": prompt, "repo_name": "woolly"},
        },
    )

    # Simulate processing delay
    await asyncio.sleep(0.5)

    # Simulate tool result
    yield sse_event(
        "toolResult",
        {"id": "tool_call_1", "result": f"Found 3 code matches for: {prompt}"},
    )

    # Simulate text streaming response in realistic chunks
    response_chunks = [
        "Based on your query '",
        prompt,
        "', I found relevant code sections. ",
        "Let me analyze them for you...\n\n",
        "The code shows several key patterns:\n",
        "1. Authentication middleware implementation\n",
        "2. JWT token validation logic\n",
        "3. Role-based access control\n\n",
    ]

    # Stream text in realistic chunks
    for chunk in response_chunks:
        yield sse_event("text", {"delta": chunk})
        await asyncio.sleep(0.2)  # Realistic typing delay

    # Simulate second tool call for deeper analysis
    yield sse_event(
        "toolCall",
        {
            "id": "tool_call_2",
            "name": "qa_codebase",
            "args": {
                "question": f"How does {prompt} work in the codebase?",
                "repo_name": "woolly",
            },
        },
    )

    await asyncio.sleep(0.3)

    # Second tool result
    yield sse_event(
        "toolResult",
        {
            "id": "tool_call_2",
            "result": "The code analysis shows a well-structured implementation with proper error handling.",
        },
    )

    # Final text stream in chunks
    final_chunks = [
        "\n\nThe analysis is complete. ",
        "The code follows best practices ",
        "and is well-documented with proper error handling.",
    ]

    for chunk in final_chunks:
        yield sse_event("text", {"delta": chunk})
        await asyncio.sleep(0.3)

    # Signal completion
    yield sse_event("done", {})


@router.post("/mock")
async def stream_mock_agent(request: StreamRequest):
    """
    PoC streaming endpoint that returns mock events in Vercel AI SDK v4 format.
    
    Test with:
    curl -X POST http://localhost:8000/api/streaming/mock \
         -H "Content-Type: application/json" \
         -d '{"prompt": "authentication system"}' \
         --no-buffer
    """

    async def event_generator():
        try:
            async for event in mock_agent_stream(request.prompt):
                yield event
        except Exception as e:
            # Error handling - send error event then close
            yield sse_event("error", {"message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    )


@router.get("/test")
async def test_sse_format():
    """
    Simple test endpoint to verify SSE format without streaming.
    Returns a single event to validate format.
    """
    return {
        "example_events": [
            {"type": "text", "delta": "Hello"},
            {
                "type": "toolCall",
                "id": "test_1",
                "name": "test_tool",
                "args": {"param": "value"},
            },
            {
                "type": "toolResult",
                "id": "test_1",
                "result": "Tool executed successfully",
            },
            {"type": "done"},
        ],
        "sse_format_example": 'data: {"type": "text", "delta": "Hello"}\\n\\n',
    }
