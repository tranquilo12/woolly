"""
AI SDK V5 Streaming Demo
========================

Demonstrates actual AI SDK V5 compatible streaming format used throughout Woolly.
This endpoint showcases the real V5 format with tool calls, text streaming,
and proper end-of-stream messages that match our production implementation.
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


async def mock_v5_agent_stream(prompt: str) -> AsyncGenerator[str, None]:
    """
    Mock agent streaming that demonstrates actual AI SDK V5 format:
    1. Tool call events (9:{...})
    2. Tool result events (a:{...})
    3. Text streaming events (0:"text")
    4. End-of-stream message (e:{...})

    This matches the exact format used by our production endpoints.
    """
    from api.utils.models import (
        build_text_stream,
        build_tool_call_partial,
        build_tool_call_result,
        build_end_of_stream_message,
    )

    # Initial status message
    yield build_text_stream(f"🔍 Analyzing '{prompt}' in the codebase...\n\n")
    await asyncio.sleep(0.3)

    # Simulate initial tool call using actual V5 format
    yield build_tool_call_partial(
        tool_call_id="tool_call_1",
        tool_name="search_code",
        args={"query": prompt, "repo_name": "woolly"},
    )

    # Simulate processing delay
    await asyncio.sleep(0.5)

    # Simulate tool result using actual V5 format
    yield build_tool_call_result(
        tool_call_id="tool_call_1",
        tool_name="search_code",
        args={"query": prompt, "repo_name": "woolly"},
        result={"matches": 3, "files": ["auth.py", "middleware.py", "utils.py"]},
    )

    # Simulate text streaming response in realistic chunks using V5 format
    response_chunks = [
        "Based on your query '",
        prompt,
        "', I found relevant code sections. ",
        "Let me analyze them for you...\n\n",
        "📁 **Files Found:**\n",
        "• `auth.py` - Authentication logic\n",
        "• `middleware.py` - Request processing\n",
        "• `utils.py` - Helper functions\n\n",
        "🔍 **Key Patterns Identified:**\n",
        "1. Authentication middleware implementation\n",
        "2. JWT token validation logic\n",
        "3. Role-based access control\n\n",
    ]

    # Stream text in realistic chunks using V5 format
    for chunk in response_chunks:
        yield build_text_stream(chunk)
        await asyncio.sleep(0.2)  # Realistic typing delay

    # Simulate second tool call for deeper analysis using V5 format
    yield build_tool_call_partial(
        tool_call_id="tool_call_2",
        tool_name="qa_codebase",
        args={
            "question": f"How does {prompt} work in the codebase?",
            "repo_name": "woolly",
        },
    )

    await asyncio.sleep(0.4)

    # Second tool result using V5 format
    yield build_tool_call_result(
        tool_call_id="tool_call_2",
        tool_name="qa_codebase",
        args={
            "question": f"How does {prompt} work in the codebase?",
            "repo_name": "woolly",
        },
        result={
            "analysis": "Well-structured implementation with proper error handling",
            "confidence": 0.95,
            "recommendations": ["Add more unit tests", "Consider rate limiting"],
        },
    )

    # Final text stream in chunks using V5 format
    final_chunks = [
        "\n📊 **Analysis Results:**\n",
        "• Code quality: Excellent\n",
        "• Error handling: Comprehensive\n",
        "• Documentation: Well-documented\n",
        "• Test coverage: Good\n\n",
        "✅ **Analysis complete!** The code follows best practices ",
        "and maintains high quality standards.\n\n",
    ]

    for chunk in final_chunks:
        yield build_text_stream(chunk)
        await asyncio.sleep(0.3)

    # Signal completion using actual V5 end-of-stream format
    yield build_end_of_stream_message(
        finish_reason="stop",
        prompt_tokens=45,  # Realistic token count
        completion_tokens=180,  # Realistic token count
        is_continued=False,
    )


@router.post("/mock")
async def stream_mock_agent(request: StreamRequest):
    """
    AI SDK V5 streaming demo endpoint that showcases the actual format used in production.
    
    This endpoint demonstrates:
    - Tool calls in V5 format (9:{...})
    - Tool results in V5 format (a:{...})
    - Text streaming in V5 format (0:"text")
    - End-of-stream in V5 format (e:{...})
    
    Test with:
    curl -X POST http://localhost:8000/api/streaming/mock \
         -H "Content-Type: application/json" \
         -d '{"prompt": "authentication system"}' \
         --no-buffer
    """

    async def v5_event_generator():
        from api.utils.models import build_text_stream, build_end_of_stream_message

        try:
            async for event in mock_v5_agent_stream(request.prompt):
                yield event
        except Exception as e:
            # Error handling using V5 format
            yield build_text_stream(f"\n❌ Streaming error: {str(e)}\n\n")
            yield build_end_of_stream_message(
                finish_reason="error",
                prompt_tokens=0,
                completion_tokens=0,
                is_continued=False,
            )

    return StreamingResponse(
        v5_event_generator(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    )


@router.get("/test")
async def test_v5_format():
    """
    Test endpoint showing actual AI SDK V5 format used throughout Woolly.

    This demonstrates the exact format strings that our streaming endpoints produce,
    which can be used for frontend integration testing and format validation.
    """
    from api.utils.models import (
        build_text_stream,
        build_tool_call_partial,
        build_tool_call_result,
        build_end_of_stream_message,
    )

    # Generate actual V5 format examples
    text_example = build_text_stream("Hello from AI SDK V5!")
    tool_call_example = build_tool_call_partial(
        tool_call_id="test_1",
        tool_name="search_code",
        args={"query": "authentication", "repo": "woolly"},
    )
    tool_result_example = build_tool_call_result(
        tool_call_id="test_1",
        tool_name="search_code",
        args={"query": "authentication", "repo": "woolly"},
        result={"matches": 5, "files": ["auth.py", "middleware.py"]},
    )
    end_stream_example = build_end_of_stream_message(
        finish_reason="stop",
        prompt_tokens=25,
        completion_tokens=150,
        is_continued=False,
    )

    return {
        "format": "AI SDK V5",
        "description": "Actual streaming format used by Woolly backend",
        "examples": {
            "text_streaming": {
                "description": "Text content streaming",
                "format": '0:"content"',
                "example": text_example.strip(),
            },
            "tool_call": {
                "description": "Tool invocation (partial call)",
                "format": "9:{...}",
                "example": tool_call_example.strip(),
            },
            "tool_result": {
                "description": "Tool execution result",
                "format": "a:{...}",
                "example": tool_result_example.strip(),
            },
            "end_of_stream": {
                "description": "Stream completion with usage stats",
                "format": "e:{...}",
                "example": end_stream_example.strip(),
            },
        },
        "media_type": "text/plain",
        "endpoints_using_v5": [
            "/api/chat/{chat_id}",
            "/api/v1/agents/execute/streaming",
            "/api/v1/agents/execute/single",
            "/api/v1/triage/execute/streaming",
            "/api/streaming/mock",
        ],
        "migration_status": "✅ All streaming endpoints upgraded to V5",
    }
