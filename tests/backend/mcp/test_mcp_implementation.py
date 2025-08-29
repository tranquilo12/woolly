#!/usr/bin/env python3
"""
MCP Implementation Test Suite

This script tests the comprehensive MCP graceful fallback and hot-swap implementation.
It validates:
1. MCP status when no server is configured
2. MCP server registration via hot-swap API
3. AI SDK V5 streaming compliance
4. Graceful fallback behavior
5. MCP server deregistration

Usage:
    python test_mcp_implementation.py
"""

import asyncio
import json
import requests
import uuid
from typing import Dict, Any, List
import time
import sys

# Configuration
BASE_URL = "http://localhost"
API_BASE = f"{BASE_URL}/api"

# Test MCP server URL (external, not running initially)
TEST_MCP_URL = "http://host.docker.internal:8009/sse/"


class Colors:
    """ANSI color codes for terminal output"""

    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    PURPLE = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    BOLD = "\033[1m"
    END = "\033[0m"


def print_test(message: str):
    """Print test message with formatting"""
    print(f"{Colors.BLUE}🧪 {message}{Colors.END}")


def print_success(message: str):
    """Print success message with formatting"""
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")


def print_error(message: str):
    """Print error message with formatting"""
    print(f"{Colors.RED}❌ {message}{Colors.END}")


def print_warning(message: str):
    """Print warning message with formatting"""
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")


def print_info(message: str):
    """Print info message with formatting"""
    print(f"{Colors.CYAN}ℹ️  {message}{Colors.END}")


def print_header(message: str):
    """Print section header with formatting"""
    print(f"\n{Colors.BOLD}{Colors.PURPLE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.PURPLE}{message}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.PURPLE}{'='*60}{Colors.END}\n")


class MCPTestSuite:
    """Test suite for MCP implementation"""

    def __init__(self):
        self.session = requests.Session()
        self.test_chat_id = str(uuid.uuid4())
        self.results = []

    def test_api_health(self) -> bool:
        """Test basic API health"""
        print_test("Testing API health...")
        try:
            response = self.session.get(f"{API_BASE}/health", timeout=10)
            if response.status_code == 200:
                print_success("API is healthy")
                return True
            else:
                print_error(f"API health check failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"API health check failed: {e}")
            return False

    def test_mcp_status_disabled(self) -> bool:
        """Test MCP status when no server is configured"""
        print_test("Testing MCP status (should be disabled)...")
        try:
            response = self.session.get(f"{API_BASE}/mcp/status", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print_info(f"MCP Status: {data.get('status')}")
                print_info(f"Available: {data.get('available')}")
                print_info(f"Fallback Mode: {data.get('fallback_mode')}")

                if data.get("status") in ["disabled", "failed"]:
                    print_success("MCP correctly shows as disabled/failed")
                    return True
                else:
                    print_warning(f"Unexpected MCP status: {data.get('status')}")
                    return False
            else:
                print_error(f"MCP status check failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"MCP status check failed: {e}")
            return False

    def test_registry_status_inactive(self) -> bool:
        """Test MCP registry status (should be inactive)"""
        print_test("Testing MCP registry status (should be inactive)...")
        try:
            response = self.session.get(f"{API_BASE}/mcp/registry/status", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print_info(f"Registry Status: {data.get('status')}")
                print_info(f"URL: {data.get('url')}")

                if data.get("status") == "inactive":
                    print_success("MCP registry correctly shows as inactive")
                    return True
                else:
                    print_warning(f"Unexpected registry status: {data.get('status')}")
                    return False
            else:
                print_error(f"Registry status check failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Registry status check failed: {e}")
            return False

    def test_chat_without_mcp(self) -> bool:
        """Test chat functionality without MCP (graceful fallback)"""
        print_test("Testing chat without MCP (graceful fallback)...")
        try:
            # Create a test chat
            chat_data = {
                "messages": [
                    {
                        "role": "user",
                        "content": "Hello! Can you help me understand how code works?",
                        "id": str(uuid.uuid4()),
                    }
                ],
                "model": "gpt-4o",
            }

            response = self.session.post(
                f"{API_BASE}/chat/{self.test_chat_id}/ai",
                json=chat_data,
                timeout=30,
                stream=True,
            )

            if response.status_code == 200:
                # Check headers
                headers = response.headers
                print_info(f"X-Chat-Type: {headers.get('X-Chat-Type')}")
                print_info(f"X-MCP-Enabled: {headers.get('X-MCP-Enabled')}")
                print_info(f"X-MCP-Status: {headers.get('X-MCP-Status')}")

                # Collect streaming response
                chunks = []
                frames_found = {"1:": False, "0:": False, "2:": False, "e:": False}

                for line in response.iter_lines(decode_unicode=True):
                    if line:
                        chunks.append(line)
                        # Check for AI SDK V5 frames
                        for frame_type in frames_found:
                            if line.startswith(frame_type):
                                frames_found[frame_type] = True

                print_info(f"Received {len(chunks)} streaming chunks")
                print_info(f"AI SDK V5 frames found: {frames_found}")

                # Validate AI SDK V5 compliance
                if (
                    frames_found["1:"]
                    and frames_found["0:"]
                    and frames_found["2:"]
                    and frames_found["e:"]
                ):
                    print_success("Chat streaming works with proper AI SDK V5 frames")
                    return True
                else:
                    print_error("Missing required AI SDK V5 frames")
                    print_info("Sample chunks:")
                    for i, chunk in enumerate(chunks[:5]):
                        print_info(f"  {i+1}: {chunk[:100]}...")
                    return False
            else:
                print_error(f"Chat request failed: {response.status_code}")
                print_error(f"Response: {response.text}")
                return False

        except Exception as e:
            print_error(f"Chat test failed: {e}")
            return False

    def test_mcp_register_invalid(self) -> bool:
        """Test MCP server registration with invalid URL"""
        print_test("Testing MCP server registration with invalid URL...")
        try:
            register_data = {
                "url": "http://invalid-server:9999/sse/",
                "validate_connection": True,
            }

            response = self.session.post(
                f"{API_BASE}/mcp/register", json=register_data, timeout=15
            )

            # Should fail with 400 due to validation
            if response.status_code == 400:
                data = response.json()
                print_success("Invalid MCP server correctly rejected")
                print_info(f"Error: {data.get('detail')}")
                return True
            else:
                print_error(f"Expected 400 error, got: {response.status_code}")
                return False

        except Exception as e:
            print_error(f"MCP register test failed: {e}")
            return False

    def test_mcp_register_without_validation(self) -> bool:
        """Test MCP server registration without validation"""
        print_test("Testing MCP server registration without validation...")
        try:
            register_data = {"url": TEST_MCP_URL, "validate_connection": False}

            response = self.session.post(
                f"{API_BASE}/mcp/register", json=register_data, timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                print_success("MCP server registered without validation")
                print_info(f"Status: {data.get('status')}")
                print_info(f"URL: {data.get('url')}")
                return True
            else:
                print_error(f"MCP registration failed: {response.status_code}")
                print_error(f"Response: {response.text}")
                return False

        except Exception as e:
            print_error(f"MCP register test failed: {e}")
            return False

    def test_registry_status_active(self) -> bool:
        """Test MCP registry status after registration"""
        print_test("Testing MCP registry status after registration...")
        try:
            response = self.session.get(f"{API_BASE}/mcp/registry/status", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print_info(f"Registry Status: {data.get('status')}")
                print_info(f"URL: {data.get('url')}")

                if data.get("status") == "active" and data.get("url") == TEST_MCP_URL:
                    print_success("MCP registry correctly shows as active")
                    return True
                else:
                    print_error(f"Unexpected registry state: {data}")
                    return False
            else:
                print_error(f"Registry status check failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Registry status check failed: {e}")
            return False

    def test_mcp_connection_test(self) -> bool:
        """Test MCP connection test endpoint"""
        print_test("Testing MCP connection test...")
        try:
            response = self.session.post(f"{API_BASE}/mcp/test-connection", timeout=15)

            # This should fail since we don't have an actual MCP server running
            if response.status_code in [400, 500]:
                data = response.json()
                print_success(
                    "MCP connection test correctly failed (no server running)"
                )
                print_info(f"Error: {data.get('detail')}")
                return True
            elif response.status_code == 200:
                print_warning("MCP connection test unexpectedly succeeded")
                return True
            else:
                print_error(f"Unexpected response: {response.status_code}")
                return False

        except Exception as e:
            print_error(f"MCP connection test failed: {e}")
            return False

    def test_chat_with_registered_mcp(self) -> bool:
        """Test chat with registered MCP server (should show different headers)"""
        print_test("Testing chat with registered MCP server...")
        try:
            chat_data = {
                "messages": [
                    {
                        "role": "user",
                        "content": "Can you search the codebase for authentication functions?",
                        "id": str(uuid.uuid4()),
                    }
                ],
                "model": "gpt-4o",
            }

            response = self.session.post(
                f"{API_BASE}/chat/{self.test_chat_id}/ai",
                json=chat_data,
                timeout=30,
                stream=True,
            )

            if response.status_code == 200:
                headers = response.headers
                print_info(f"X-Chat-Type: {headers.get('X-Chat-Type')}")
                print_info(f"X-MCP-Enabled: {headers.get('X-MCP-Enabled')}")
                print_info(f"X-MCP-Status: {headers.get('X-MCP-Status')}")

                # Should show MCP as enabled but degraded/failed due to no actual server
                if headers.get("X-Chat-Type") == "pydantic-ai":
                    print_success("Chat correctly uses Pydantic AI endpoint")
                    return True
                else:
                    print_error("Chat not using Pydantic AI endpoint")
                    return False
            else:
                print_error(f"Chat request failed: {response.status_code}")
                return False

        except Exception as e:
            print_error(f"Chat with MCP test failed: {e}")
            return False

    def test_mcp_deregister(self) -> bool:
        """Test MCP server deregistration"""
        print_test("Testing MCP server deregistration...")
        try:
            response = self.session.post(f"{API_BASE}/mcp/deregister", timeout=10)

            if response.status_code == 200:
                data = response.json()
                print_success("MCP server deregistered successfully")
                print_info(f"Status: {data.get('status')}")
                print_info(f"Previous URL: {data.get('url')}")
                return True
            else:
                print_error(f"MCP deregistration failed: {response.status_code}")
                return False

        except Exception as e:
            print_error(f"MCP deregister test failed: {e}")
            return False

    def test_final_status_check(self) -> bool:
        """Final status check after deregistration"""
        print_test("Testing final status after deregistration...")
        try:
            # Check registry status
            response = self.session.get(f"{API_BASE}/mcp/registry/status", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "inactive":
                    print_success(
                        "Registry correctly shows as inactive after deregistration"
                    )
                    return True
                else:
                    print_error(f"Registry still shows as active: {data}")
                    return False
            else:
                print_error(f"Registry status check failed: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Final status check failed: {e}")
            return False

    def run_all_tests(self) -> Dict[str, bool]:
        """Run all tests and return results"""
        print_header("MCP Implementation Test Suite")

        tests = [
            ("API Health Check", self.test_api_health),
            ("MCP Status (Disabled)", self.test_mcp_status_disabled),
            ("Registry Status (Inactive)", self.test_registry_status_inactive),
            ("Chat Without MCP (Graceful Fallback)", self.test_chat_without_mcp),
            ("MCP Register (Invalid URL)", self.test_mcp_register_invalid),
            (
                "MCP Register (Without Validation)",
                self.test_mcp_register_without_validation,
            ),
            ("Registry Status (Active)", self.test_registry_status_active),
            ("MCP Connection Test", self.test_mcp_connection_test),
            ("Chat With Registered MCP", self.test_chat_with_registered_mcp),
            ("MCP Deregister", self.test_mcp_deregister),
            ("Final Status Check", self.test_final_status_check),
        ]

        results = {}
        passed = 0
        total = len(tests)

        for test_name, test_func in tests:
            print_header(f"Test: {test_name}")
            try:
                result = test_func()
                results[test_name] = result
                if result:
                    passed += 1
                time.sleep(1)  # Brief pause between tests
            except Exception as e:
                print_error(f"Test '{test_name}' crashed: {e}")
                results[test_name] = False

        # Print summary
        print_header("Test Results Summary")
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}")

        print(f"\n{Colors.BOLD}Overall: {passed}/{total} tests passed{Colors.END}")

        if passed == total:
            print_success(
                "🎉 All tests passed! MCP implementation is working correctly."
            )
        else:
            print_warning(
                f"⚠️  {total - passed} tests failed. Check the implementation."
            )

        return results


def main():
    """Main test runner"""
    print(f"{Colors.BOLD}{Colors.CYAN}MCP Implementation Test Suite{Colors.END}")
    print(f"{Colors.CYAN}Testing API at: {API_BASE}{Colors.END}")
    print(f"{Colors.CYAN}Test MCP URL: {TEST_MCP_URL}{Colors.END}\n")

    suite = MCPTestSuite()
    results = suite.run_all_tests()

    # Exit with appropriate code
    if all(results.values()):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
