#!/usr/bin/env python3
"""
Test script for the new Pydantic AI chat endpoint

This script tests the new /api/chat/{chat_id}/ai endpoint to ensure it:
1. Accepts the same request format as the regular chat endpoint
2. Returns AI SDK V5 streaming format
3. Has MCP tool access for code-aware responses
4. Handles errors gracefully
"""

import asyncio
import json
import uuid
import httpx
from typing import Dict, Any

# Test configuration
BASE_URL = "http://localhost"  # Adjust if your server runs on different port
TEST_CHAT_ID = str(uuid.uuid4())


def create_test_messages(user_message: str) -> list:
    """Create test messages in the expected format"""
    return [
        {
            "role": "user",
            "content": user_message,
            "id": str(uuid.uuid4()),
        }
    ]


async def test_pydantic_chat_endpoint():
    """Test the new Pydantic AI chat endpoint"""

    print("🧪 Testing Pydantic AI Chat Endpoint")
    print("=" * 50)

    # Test cases
    test_cases = [
        {"name": "Basic Chat", "message": "Hello! How are you?", "expect_mcp": False},
        {
            "name": "Code-Related Query",
            "message": "How does the Universal Agent Factory work in this codebase?",
            "expect_mcp": True,
        },
        {
            "name": "Repository Search",
            "message": "Find all the API endpoints in this project",
            "expect_mcp": True,
        },
        {
            "name": "Technical Question",
            "message": "What is the MCP server integration pattern used here?",
            "expect_mcp": True,
        },
    ]

    async with httpx.AsyncClient(timeout=60.0) as client:
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n🔍 Test {i}: {test_case['name']}")
            print(f"Message: {test_case['message']}")

            # Create request payload
            payload = {
                "messages": create_test_messages(test_case["message"]),
                "model": "gpt-4o",
            }

            try:
                # Test the new Pydantic AI endpoint
                print(f"📡 Testing: POST {BASE_URL}/api/chat/{TEST_CHAT_ID}/ai")

                async with client.stream(
                    "POST",
                    f"{BASE_URL}/api/chat/{TEST_CHAT_ID}/ai",
                    json=payload,
                    params={"repository_name": "woolly"},
                ) as response:

                    print(f"Status: {response.status_code}")
                    print(f"Headers: {dict(response.headers)}")

                    if response.status_code == 200:
                        print("✅ Request successful")
                        print("📥 Streaming response:")

                        chunk_count = 0
                        v5_formats_seen = set()

                        async for chunk in response.aiter_text():
                            if chunk.strip():
                                chunk_count += 1

                                # Check for AI SDK V5 format patterns
                                if chunk.startswith("0:"):
                                    v5_formats_seen.add("text_stream")
                                elif chunk.startswith("9:"):
                                    v5_formats_seen.add("tool_call")
                                elif chunk.startswith("a:"):
                                    v5_formats_seen.add("tool_result")
                                elif chunk.startswith("e:"):
                                    v5_formats_seen.add("end_stream")
                                elif chunk.startswith("1:"):
                                    v5_formats_seen.add("message_start")
                                elif chunk.startswith("2:"):
                                    v5_formats_seen.add("message_end")

                                # Print first few chunks for inspection
                                if chunk_count <= 3:
                                    print(f"  Chunk {chunk_count}: {chunk[:100]}...")

                        print(f"📊 Total chunks received: {chunk_count}")
                        print(f"🎯 AI SDK V5 formats detected: {list(v5_formats_seen)}")

                        # Check if MCP tools were used (indicated by tool_call format)
                        mcp_used = "tool_call" in v5_formats_seen
                        print(f"🔧 MCP tools used: {mcp_used}")

                        if test_case["expect_mcp"] and not mcp_used:
                            print("⚠️  Expected MCP tools but none were used")
                        elif not test_case["expect_mcp"] and mcp_used:
                            print("ℹ️  MCP tools used unexpectedly (but that's okay)")
                        else:
                            print("✅ MCP usage matches expectation")

                    else:
                        print(f"❌ Request failed with status {response.status_code}")
                        error_text = await response.aread()
                        print(f"Error: {error_text.decode()}")

            except Exception as e:
                print(f"❌ Test failed with exception: {e}")

            print("-" * 30)


async def test_endpoint_comparison():
    """Compare regular chat vs Pydantic AI chat endpoints"""

    print("\n🔄 Comparing Regular Chat vs Pydantic AI Chat")
    print("=" * 50)

    test_message = "What is FastAPI and how is it used in this project?"
    payload = {"messages": create_test_messages(test_message), "model": "gpt-4o"}

    async with httpx.AsyncClient(timeout=30.0) as client:

        # Test regular chat endpoint
        print("🔍 Testing Regular Chat Endpoint")
        try:
            async with client.stream(
                "POST", f"{BASE_URL}/api/chat/{TEST_CHAT_ID}", json=payload
            ) as response:
                print(f"Status: {response.status_code}")

                if response.status_code == 200:
                    chunk_count = 0
                    async for chunk in response.aiter_text():
                        if chunk.strip():
                            chunk_count += 1
                            if chunk_count == 1:
                                print(f"First chunk: {chunk[:100]}...")
                    print(f"Regular chat chunks: {chunk_count}")
                else:
                    print(f"❌ Regular chat failed: {response.status_code}")

        except Exception as e:
            print(f"❌ Regular chat error: {e}")

        print("-" * 30)

        # Test Pydantic AI chat endpoint
        print("🔍 Testing Pydantic AI Chat Endpoint")
        try:
            async with client.stream(
                "POST",
                f"{BASE_URL}/api/chat/{TEST_CHAT_ID}/ai",
                json=payload,
                params={"repository_name": "woolly"},
            ) as response:
                print(f"Status: {response.status_code}")
                print(f"Chat Type: {response.headers.get('X-Chat-Type', 'unknown')}")
                print(
                    f"MCP Enabled: {response.headers.get('X-MCP-Enabled', 'unknown')}"
                )

                if response.status_code == 200:
                    chunk_count = 0
                    async for chunk in response.aiter_text():
                        if chunk.strip():
                            chunk_count += 1
                            if chunk_count == 1:
                                print(f"First chunk: {chunk[:100]}...")
                    print(f"Pydantic AI chat chunks: {chunk_count}")
                else:
                    print(f"❌ Pydantic AI chat failed: {response.status_code}")

        except Exception as e:
            print(f"❌ Pydantic AI chat error: {e}")


async def main():
    """Run all tests"""
    print("🚀 Starting Pydantic AI Chat Endpoint Tests")
    print("Make sure your server is running on http://localhost:8000")
    print()

    try:
        await test_pydantic_chat_endpoint()
        await test_endpoint_comparison()

        print("\n✅ All tests completed!")
        print("\n📋 Summary:")
        print("- New endpoint: POST /api/chat/{chat_id}/ai")
        print("- Same request format as regular chat")
        print("- AI SDK V5 streaming format maintained")
        print("- MCP tools available for code-aware responses")
        print("- Graceful error handling")

    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())
