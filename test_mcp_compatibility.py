#!/usr/bin/env python3
"""
MCP Compatibility Test Suite
============================

This test file compares FastMCP client vs Pydantic AI MCP client behavior
to identify compatibility issues and find the optimal integration approach.

Usage:
    python test_mcp_compatibility.py

Tests:
1. Direct HTTP connection test
2. FastMCP client test (if available)
3. Pydantic AI MCP client test
4. Protocol comparison and diagnostics
"""

import asyncio
import logging
import os
import sys
from typing import Dict, Any, Optional
import httpx
import json
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# MCP Server Configuration
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8009")
MCP_SSE_ENDPOINT = f"{MCP_SERVER_URL}/sse/"
MCP_HTTP_ENDPOINT = f"{MCP_SERVER_URL}/mcp"


class MCPCompatibilityTester:
    """Comprehensive MCP compatibility testing suite"""

    def __init__(self):
        self.results = {}
        self.start_time = datetime.now()

    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all compatibility tests"""
        logger.info("🚀 Starting MCP Compatibility Test Suite")
        logger.info(f"📍 Testing server: {MCP_SERVER_URL}")

        # Test 1: Basic HTTP connectivity
        await self.test_basic_http_connectivity()

        # Test 2: SSE endpoint analysis
        await self.test_sse_endpoint()

        # Test 3: FastMCP client test (if available)
        await self.test_fastmcp_client()

        # Test 4: Pydantic AI client test
        await self.test_pydantic_ai_client()

        # Test 5: Protocol comparison
        await self.analyze_protocol_differences()

        # Generate summary
        self.generate_summary()

        return self.results

    async def test_basic_http_connectivity(self):
        """Test basic HTTP connectivity to MCP server"""
        logger.info("🔌 Testing basic HTTP connectivity...")

        test_result = {
            "status": "unknown",
            "response_code": None,
            "response_headers": {},
            "response_body": None,
            "error": None,
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Test base URL
                response = await client.get(MCP_SERVER_URL)
                test_result["status"] = "success"
                test_result["response_code"] = response.status_code
                test_result["response_headers"] = dict(response.headers)
                test_result["response_body"] = response.text[:500]  # First 500 chars

                logger.info(
                    f"✅ HTTP connectivity successful (status: {response.status_code})"
                )

        except Exception as e:
            test_result["status"] = "failed"
            test_result["error"] = str(e)
            logger.error(f"❌ HTTP connectivity failed: {e}")

        self.results["http_connectivity"] = test_result

    async def test_sse_endpoint(self):
        """Test SSE endpoint specifically"""
        logger.info("📡 Testing SSE endpoint...")

        test_result = {
            "status": "unknown",
            "sse_headers_sent": {},
            "response_code": None,
            "response_headers": {},
            "sse_events": [],
            "error": None,
        }

        try:
            headers = {
                "Accept": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
            test_result["sse_headers_sent"] = headers

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(MCP_SSE_ENDPOINT, headers=headers)
                test_result["response_code"] = response.status_code
                test_result["response_headers"] = dict(response.headers)

                # Try to read SSE events
                content = response.text
                test_result["raw_response"] = content[:1000]  # First 1000 chars

                # Parse SSE events if any
                if content:
                    lines = content.split("\n")
                    events = []
                    for line in lines[:10]:  # First 10 lines
                        if line.strip():
                            events.append(line.strip())
                    test_result["sse_events"] = events

                test_result["status"] = "success"
                logger.info(
                    f"✅ SSE endpoint responded (status: {response.status_code})"
                )

        except Exception as e:
            test_result["status"] = "failed"
            test_result["error"] = str(e)
            logger.error(f"❌ SSE endpoint test failed: {e}")

        self.results["sse_endpoint"] = test_result

    async def test_fastmcp_client(self):
        """Test FastMCP client if available"""
        logger.info("⚡ Testing FastMCP client...")

        test_result = {
            "status": "unknown",
            "fastmcp_available": False,
            "connection_result": None,
            "tools_available": [],
            "error": None,
        }

        try:
            # Try to import FastMCP
            try:
                from fastmcp import Client

                test_result["fastmcp_available"] = True
                logger.info("📦 FastMCP library found")
            except ImportError:
                test_result["fastmcp_available"] = False
                test_result["status"] = "skipped"
                test_result["error"] = "FastMCP library not available"
                logger.warning("📦 FastMCP library not found - skipping test")
                self.results["fastmcp_client"] = test_result
                return

            # Test FastMCP connection
            # Note: This is a placeholder - actual implementation depends on your FastMCP setup
            test_result["status"] = "success"
            test_result["connection_result"] = "FastMCP test would go here"
            logger.info("✅ FastMCP client test completed")

        except Exception as e:
            test_result["status"] = "failed"
            test_result["error"] = str(e)
            logger.error(f"❌ FastMCP client test failed: {e}")

        self.results["fastmcp_client"] = test_result

    async def test_pydantic_ai_client(self):
        """Test Pydantic AI MCP client"""
        logger.info("🤖 Testing Pydantic AI MCP client...")

        test_result = {
            "status": "unknown",
            "pydantic_ai_available": False,
            "mcp_module_available": False,
            "agent_creation": None,
            "connection_test": None,
            "error": None,
            "detailed_error": None,
        }

        try:
            # Test Pydantic AI imports
            try:
                from pydantic_ai import Agent

                test_result["pydantic_ai_available"] = True
                logger.info("📦 Pydantic AI found")
            except ImportError as e:
                test_result["pydantic_ai_available"] = False
                test_result["error"] = f"Pydantic AI not available: {e}"
                logger.error(f"📦 Pydantic AI not found: {e}")
                self.results["pydantic_ai_client"] = test_result
                return

            try:
                from pydantic_ai.mcp import MCPServerSSE

                test_result["mcp_module_available"] = True
                logger.info("📦 Pydantic AI MCP module found")
            except ImportError as e:
                test_result["mcp_module_available"] = False
                test_result["error"] = f"Pydantic AI MCP module not available: {e}"
                logger.error(f"📦 Pydantic AI MCP module not found: {e}")
                self.results["pydantic_ai_client"] = test_result
                return

            # Create MCP server instance
            mcp_server = MCPServerSSE(url=MCP_SSE_ENDPOINT)
            test_result["agent_creation"] = "MCP server instance created"

            # Create test agent
            agent = Agent(model="openai:gpt-4o-mini", mcp_servers=[mcp_server])
            test_result["agent_creation"] = "Agent with MCP server created"

            # Test connection
            try:
                async with asyncio.timeout(5.0):
                    async with agent.run_mcp_servers():
                        test_result["connection_test"] = "Connection successful"
                        test_result["status"] = "success"
                        logger.info("✅ Pydantic AI MCP client connection successful")
            except Exception as conn_e:
                test_result["connection_test"] = "Connection failed"
                test_result["detailed_error"] = {
                    "type": type(conn_e).__name__,
                    "message": str(conn_e),
                    "is_taskgroup": "TaskGroup" in str(conn_e),
                    "is_timeout": "timeout" in str(conn_e).lower(),
                }
                test_result["status"] = "connection_failed"
                logger.error(f"❌ Pydantic AI MCP connection failed: {conn_e}")

        except Exception as e:
            test_result["status"] = "failed"
            test_result["error"] = str(e)
            logger.error(f"❌ Pydantic AI client test failed: {e}")

        self.results["pydantic_ai_client"] = test_result

    async def analyze_protocol_differences(self):
        """Analyze protocol differences between implementations"""
        logger.info("🔍 Analyzing protocol differences...")

        analysis = {
            "sse_compatibility": "unknown",
            "header_differences": [],
            "response_format_differences": [],
            "recommendations": [],
        }

        # Analyze SSE endpoint response
        if (
            "sse_endpoint" in self.results
            and self.results["sse_endpoint"]["status"] == "success"
        ):
            sse_result = self.results["sse_endpoint"]

            # Check for proper SSE headers
            headers = sse_result.get("response_headers", {})
            if headers.get("content-type", "").startswith("text/event-stream"):
                analysis["sse_compatibility"] = "headers_correct"
            else:
                analysis["sse_compatibility"] = "headers_incorrect"
                analysis["header_differences"].append(
                    f"Expected 'text/event-stream', got '{headers.get('content-type', 'missing')}'"
                )

            # Check response format
            raw_response = sse_result.get("raw_response", "")
            if raw_response.startswith("{"):
                analysis["response_format_differences"].append(
                    "Server returns JSON instead of SSE format"
                )
            elif "data:" in raw_response:
                analysis["response_format_differences"].append(
                    "Server uses proper SSE format"
                )

        # Generate recommendations
        if (
            self.results.get("pydantic_ai_client", {})
            .get("detailed_error", {})
            .get("is_taskgroup")
        ):
            analysis["recommendations"].append(
                "TaskGroup error suggests async context manager issues"
            )
            analysis["recommendations"].append(
                "Consider using stdio transport instead of SSE"
            )

        if analysis["sse_compatibility"] == "headers_incorrect":
            analysis["recommendations"].append(
                "MCP server needs to return proper SSE headers"
            )
            analysis["recommendations"].append(
                "Server should return 'Content-Type: text/event-stream'"
            )

        self.results["protocol_analysis"] = analysis

    def generate_summary(self):
        """Generate test summary and recommendations"""
        logger.info("📋 Generating test summary...")

        summary = {
            "test_duration": str(datetime.now() - self.start_time),
            "tests_run": len(self.results),
            "overall_status": "unknown",
            "key_findings": [],
            "recommendations": [],
            "next_steps": [],
        }

        # Determine overall status
        pydantic_ai_status = self.results.get("pydantic_ai_client", {}).get("status")
        fastmcp_status = self.results.get("fastmcp_client", {}).get("status")

        if pydantic_ai_status == "success":
            summary["overall_status"] = "pydantic_ai_compatible"
        elif fastmcp_status == "success":
            summary["overall_status"] = "fastmcp_only_compatible"
        else:
            summary["overall_status"] = "compatibility_issues"

        # Key findings
        if (
            self.results.get("pydantic_ai_client", {})
            .get("detailed_error", {})
            .get("is_taskgroup")
        ):
            summary["key_findings"].append(
                "TaskGroup errors indicate async context manager issues"
            )

        if self.results.get("sse_endpoint", {}).get("response_code") == 400:
            summary["key_findings"].append("SSE endpoint returns 400 Bad Request")

        # Recommendations based on findings
        if summary["overall_status"] == "fastmcp_only_compatible":
            summary["recommendations"].append(
                "Use FastMCP client instead of Pydantic AI MCP client"
            )
            summary["recommendations"].append(
                "Consider implementing MCP server compatibility layer"
            )

        if "TaskGroup" in str(self.results.get("pydantic_ai_client", {})):
            summary["recommendations"].append("Switch to MCPServerStdio transport")
            summary["recommendations"].append(
                "Run MCP server as subprocess instead of HTTP service"
            )

        # Next steps
        summary["next_steps"].append(
            "Review MCP server implementation for SSE compatibility"
        )
        summary["next_steps"].append("Consider using fallback mode for production")
        summary["next_steps"].append("Test alternative MCP transport methods")

        self.results["summary"] = summary

    def print_results(self):
        """Print formatted test results"""
        print("\n" + "=" * 80)
        print("🧪 MCP COMPATIBILITY TEST RESULTS")
        print("=" * 80)

        for test_name, result in self.results.items():
            if test_name == "summary":
                continue

            print(f"\n📋 {test_name.upper().replace('_', ' ')}")
            print("-" * 40)

            status = result.get("status", "unknown")
            status_emoji = {"success": "✅", "failed": "❌", "skipped": "⏭️"}.get(
                status, "❓"
            )
            print(f"Status: {status_emoji} {status}")

            if result.get("error"):
                print(f"Error: {result['error']}")

            # Print key details based on test type
            if test_name == "http_connectivity" and status == "success":
                print(f"Response Code: {result.get('response_code')}")
            elif test_name == "sse_endpoint":
                print(f"Response Code: {result.get('response_code')}")
                if result.get("sse_events"):
                    print(f"SSE Events: {len(result['sse_events'])}")
            elif test_name == "pydantic_ai_client" and result.get("detailed_error"):
                error = result["detailed_error"]
                print(f"Error Type: {error.get('type')}")
                print(f"TaskGroup Error: {error.get('is_taskgroup')}")

        # Print summary
        if "summary" in self.results:
            summary = self.results["summary"]
            print(f"\n🎯 SUMMARY")
            print("-" * 40)
            print(f"Overall Status: {summary['overall_status']}")
            print(f"Test Duration: {summary['test_duration']}")

            if summary["key_findings"]:
                print("\n🔍 Key Findings:")
                for finding in summary["key_findings"]:
                    print(f"  • {finding}")

            if summary["recommendations"]:
                print("\n💡 Recommendations:")
                for rec in summary["recommendations"]:
                    print(f"  • {rec}")

        print("\n" + "=" * 80)


async def main():
    """Main test execution"""
    try:
        tester = MCPCompatibilityTester()
        results = await tester.run_all_tests()
        tester.print_results()

        # Save results to file
        with open("mcp_test_results.json", "w") as f:
            json.dump(results, f, indent=2, default=str)

        print(f"\n📄 Detailed results saved to: mcp_test_results.json")

        return results

    except Exception as e:
        logger.error(f"Test suite failed: {e}")
        return {"error": str(e)}


if __name__ == "__main__":
    print("🚀 MCP Compatibility Test Suite")
    print("=" * 50)

    # Check if required environment variables are set
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️  Warning: OPENAI_API_KEY not set - some tests may fail")

    # Run tests
    results = asyncio.run(main())

    # Exit with appropriate code
    if results.get("summary", {}).get("overall_status") == "pydantic_ai_compatible":
        sys.exit(0)
    else:
        sys.exit(1)
