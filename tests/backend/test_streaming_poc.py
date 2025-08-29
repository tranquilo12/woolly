#!/usr/bin/env python3
"""
Test script for Phase 5 Streaming PoC
=====================================

Quick test to verify the streaming endpoint returns proper SSE events
compatible with Vercel AI SDK v4.
"""

import asyncio
import json
import httpx


async def test_streaming_poc():
    """Test the streaming PoC endpoint"""

    print("Testing Streaming PoC Endpoint")
    print("=" * 50)

    # Test the static format endpoint first
    async with httpx.AsyncClient() as client:
        try:
            # Test static format endpoint
            response = await client.get("http://localhost:8000/api/streaming/test")
            if response.status_code == 200:
                print("[OK] Static format endpoint working")
                print(f"     Response: {response.json()}")
            else:
                print(f"[ERROR] Static format endpoint failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"[ERROR] Connection failed: {e}")
            print(
                "        Make sure the API server is running: uvicorn api.index:app --reload"
            )
            return False

    # Test streaming endpoint
    print("\n[TEST] Testing streaming endpoint...")

    async with httpx.AsyncClient() as client:
        try:
            async with client.stream(
                "POST",
                "http://localhost:8000/api/streaming/mock",
                json={"prompt": "authentication system"},
                timeout=30.0,
            ) as response:

                if response.status_code != 200:
                    print(f"[ERROR] Streaming failed: {response.status_code}")
                    return False

                print("[OK] Streaming started, events:")
                print("-" * 30)

                event_count = 0
                async for chunk in response.aiter_text():
                    if chunk.strip():
                        # Parse SSE format
                        if chunk.startswith("data: "):
                            try:
                                data = json.loads(chunk[6:])  # Remove "data: " prefix
                                event_count += 1

                                if data.get("type") == "toolCall":
                                    print(
                                        f"[TOOL] {data.get('name')} (id: {data.get('id')})"
                                    )
                                elif data.get("type") == "toolResult":
                                    print(f"[RESULT] {data.get('result')[:50]}...")
                                elif data.get("type") == "text":
                                    print(
                                        f"[TEXT] {data.get('delta')}",
                                        end="",
                                        flush=True,
                                    )
                                elif data.get("type") == "done":
                                    print(f"\n[DONE] Stream completed")
                                    break
                                elif data.get("type") == "error":
                                    print(f"[ERROR] {data.get('message')}")
                                    break
                            except json.JSONDecodeError as e:
                                print(f"[WARN] Invalid JSON: {chunk}")

                print(f"\n[STATS] Total events received: {event_count}")
                return event_count > 0

        except Exception as e:
            print(f"[ERROR] Streaming test failed: {e}")
            return False


async def main():
    """Run all tests"""
    success = await test_streaming_poc()

    if success:
        print("\n[SUCCESS] All tests passed! PoC is working correctly.")
        print("\nNext steps:")
        print("- [DONE] Research complete (tasks #1 & #2)")
        print("- [DONE] PoC endpoint working (Step 1 complete)")
        print("- [TODO] Implement ToolBudget model (task #3)")
    else:
        print("\n[FAILED] Tests failed. Check the output above for details.")

    return success


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
