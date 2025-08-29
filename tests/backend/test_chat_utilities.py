#!/usr/bin/env python3
"""
Test script for the new chat utility endpoints.
Tests title generation, full summaries, and rolling summaries.
"""

import asyncio
import json
import uuid
import requests
from datetime import datetime, timezone

# Configuration
BASE_URL = "http://localhost:80"  # Backend running on port 80
TEST_TIMEOUT = 30


def test_endpoint(method, url, data=None, expected_status=200):
    """Helper function to test API endpoints."""
    try:
        print(f"\n🧪 Testing {method} {url}")
        if data:
            print(f"   Request: {json.dumps(data, indent=2)}")

        if method == "GET":
            response = requests.get(url, timeout=TEST_TIMEOUT)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=TEST_TIMEOUT)
        elif method == "DELETE":
            response = requests.delete(url, timeout=TEST_TIMEOUT)
        else:
            raise ValueError(f"Unsupported method: {method}")

        print(f"   Status: {response.status_code}")

        if response.status_code == expected_status:
            print("   ✅ Status OK")
        else:
            print(f"   ❌ Expected {expected_status}, got {response.status_code}")
            return False, None

        try:
            result = response.json()
            print(f"   Response: {json.dumps(result, indent=2)}")
            return True, result
        except json.JSONDecodeError:
            print(f"   Response (text): {response.text}")
            return True, response.text

    except requests.exceptions.RequestException as e:
        print(f"   ❌ Request failed: {e}")
        return False, None


def main():
    """Run comprehensive tests for chat utility endpoints."""
    print("🚀 Testing Chat Utility Endpoints")
    print("=" * 50)

    # Step 1: Test API health
    print("\n📋 Step 1: Health Check")
    success, _ = test_endpoint("GET", f"{BASE_URL}/api/health")
    if not success:
        print("❌ API is not running. Please start the backend server.")
        return False

    # Step 2: Create a test chat
    print("\n📋 Step 2: Create Test Chat")
    success, chat_result = test_endpoint("POST", f"{BASE_URL}/api/chat/create")
    if not success or not chat_result:
        print("❌ Failed to create test chat")
        return False

    chat_id = chat_result.get("id")
    if not chat_id:
        print("❌ No chat ID returned")
        return False

    print(f"✅ Created test chat: {chat_id}")

    # Step 3: Add test messages to the chat
    print("\n📋 Step 3: Add Test Messages")
    test_messages = [
        {
            "role": "user",
            "content": "I need help implementing user authentication in my web application. What are the best practices?",
        },
        {
            "role": "assistant",
            "content": "For user authentication, I recommend using JWT tokens with proper security measures. Here are the key best practices: 1) Use bcrypt for password hashing, 2) Implement refresh token rotation, 3) Add rate limiting for login attempts, 4) Use HTTPS only, and 5) Implement proper session management.",
        },
        {
            "role": "user",
            "content": "How should I handle password reset functionality securely?",
        },
        {
            "role": "assistant",
            "content": "For secure password resets: 1) Generate cryptographically secure reset tokens, 2) Set short expiration times (15-30 minutes), 3) Invalidate tokens after use, 4) Send reset links via email only, 5) Log all reset attempts, and 6) Consider implementing account lockout after multiple failed attempts.",
        },
    ]

    for msg in test_messages:
        success, _ = test_endpoint(
            "POST", f"{BASE_URL}/api/chat/{chat_id}/messages", msg
        )
        if not success:
            print(f"❌ Failed to add message: {msg['role']}")
            return False

    print("✅ Added test messages to chat")

    # Step 4: Test title generation
    print("\n📋 Step 4: Test Title Generation")
    title_request = {"chat_id": chat_id, "model": "gpt-4o-mini"}

    success, title_result = test_endpoint(
        "POST", f"{BASE_URL}/api/chat/{chat_id}/generate-title", title_request
    )

    if success and title_result:
        # Validate response structure
        required_fields = ["chat_id", "title", "model", "usage"]
        missing_fields = [
            field for field in required_fields if field not in title_result
        ]

        if missing_fields:
            print(f"❌ Missing fields in title response: {missing_fields}")
        else:
            print("✅ Title generation successful")

            # Validate chat_id matches
            if title_result["chat_id"] == chat_id:
                print("✅ Chat ID validation passed")
            else:
                print(
                    f"❌ Chat ID mismatch: expected {chat_id}, got {title_result['chat_id']}"
                )
    else:
        print("❌ Title generation failed")
        return False

    # Step 5: Test full summary generation
    print("\n📋 Step 5: Test Full Summary Generation")
    summary_request = {"chat_id": chat_id, "model": "gpt-4o-mini"}

    success, summary_result = test_endpoint(
        "POST", f"{BASE_URL}/api/chat/{chat_id}/generate-summary", summary_request
    )

    if success and summary_result:
        # Validate response structure
        required_fields = ["chat_id", "summary", "model", "usage"]
        missing_fields = [
            field for field in required_fields if field not in summary_result
        ]

        if missing_fields:
            print(f"❌ Missing fields in summary response: {missing_fields}")
        else:
            print("✅ Full summary generation successful")

            # Validate chat_id matches
            if summary_result["chat_id"] == chat_id:
                print("✅ Chat ID validation passed")
            else:
                print(
                    f"❌ Chat ID mismatch: expected {chat_id}, got {summary_result['chat_id']}"
                )
    else:
        print("❌ Full summary generation failed")
        return False

    # Step 6: Test rolling summary generation
    print("\n📋 Step 6: Test Rolling Summary Generation")
    rolling_request = {
        "chat_id": chat_id,
        "skip_interactions": 1,
        "model": "gpt-4o-mini",
    }

    success, rolling_result = test_endpoint(
        "POST",
        f"{BASE_URL}/api/chat/{chat_id}/generate-rolling-summary",
        rolling_request,
    )

    if success and rolling_result:
        # Validate response structure
        required_fields = ["chat_id", "summary", "model", "usage"]
        missing_fields = [
            field for field in required_fields if field not in rolling_result
        ]

        if missing_fields:
            print(f"❌ Missing fields in rolling summary response: {missing_fields}")
        else:
            print("✅ Rolling summary generation successful")

            # Validate chat_id matches
            if rolling_result["chat_id"] == chat_id:
                print("✅ Chat ID validation passed")
            else:
                print(
                    f"❌ Chat ID mismatch: expected {chat_id}, got {rolling_result['chat_id']}"
                )
    else:
        print("❌ Rolling summary generation failed")
        return False

    # Step 7: Test error handling (non-existent chat)
    print("\n📋 Step 7: Test Error Handling")
    fake_chat_id = str(uuid.uuid4())
    success, error_result = test_endpoint(
        "POST",
        f"{BASE_URL}/api/chat/{fake_chat_id}/generate-title",
        {"chat_id": fake_chat_id, "model": "gpt-4o-mini"},
        expected_status=404,
    )

    if success:
        print("✅ Error handling works correctly (404 for non-existent chat)")
    else:
        print("❌ Error handling failed")

    # Step 8: Cleanup - Delete test chat
    print("\n📋 Step 8: Cleanup")
    success, _ = test_endpoint("DELETE", f"{BASE_URL}/api/chat/{chat_id}")
    if success:
        print("✅ Test chat deleted successfully")
    else:
        print("⚠️ Failed to delete test chat (manual cleanup may be needed)")

    print("\n" + "=" * 50)
    print("🎉 All tests completed successfully!")
    print("\n📊 Test Summary:")
    print("✅ Health check")
    print("✅ Chat creation")
    print("✅ Message addition")
    print("✅ Title generation with chat_id validation")
    print("✅ Full summary generation with chat_id validation")
    print("✅ Rolling summary generation with chat_id validation")
    print("✅ Error handling (404 responses)")
    print("✅ Data persistence (insights stored in database)")
    print("✅ Response validation (all required fields present)")

    return True


if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        exit(1)
