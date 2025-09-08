#!/usr/bin/env python3
"""
Comprehensive Backend Testing Script
Tests all the changes we made to the MCP registry system and API v2 endpoints
"""

import asyncio
import json
import time
from typing import Dict, Any, List
import httpx
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.tree import Tree

console = Console()


class BackendTester:
    def __init__(self, base_url: str = "http://localhost"):
        self.base_url = base_url
        self.results = []
        self.chat_id = None

    async def test_endpoint(
        self,
        method: str,
        endpoint: str,
        data: Dict = None,
        expected_status: int = 200,
        description: str = "",
    ) -> Dict[str, Any]:
        """Test a single endpoint and return results"""
        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if method.upper() == "GET":
                    response = await client.get(f"{self.base_url}{endpoint}")
                elif method.upper() == "POST":
                    response = await client.post(
                        f"{self.base_url}{endpoint}",
                        json=data,
                        headers={"Content-Type": "application/json"},
                    )
                elif method.upper() == "PATCH":
                    response = await client.patch(
                        f"{self.base_url}{endpoint}",
                        json=data,
                        headers={"Content-Type": "application/json"},
                    )
                elif method.upper() == "DELETE":
                    response = await client.delete(f"{self.base_url}{endpoint}")
                else:
                    raise ValueError(f"Unsupported method: {method}")

                duration = time.time() - start_time

                # Try to parse JSON response
                try:
                    response_data = response.json()
                except:
                    response_data = {"raw_response": response.text[:200]}

                result = {
                    "method": method.upper(),
                    "endpoint": endpoint,
                    "description": description,
                    "status_code": response.status_code,
                    "expected_status": expected_status,
                    "success": response.status_code == expected_status,
                    "duration": round(duration, 3),
                    "response_data": response_data,
                    "headers": dict(response.headers),
                }

                self.results.append(result)
                return result

        except Exception as e:
            duration = time.time() - start_time
            result = {
                "method": method.upper(),
                "endpoint": endpoint,
                "description": description,
                "status_code": 0,
                "expected_status": expected_status,
                "success": False,
                "duration": round(duration, 3),
                "error": str(e),
                "response_data": None,
                "headers": {},
            }
            self.results.append(result)
            return result

    async def test_health_endpoints(self):
        """Test all health and system endpoints"""
        console.print("\n[bold blue]🏥 Testing Health & System Endpoints[/bold blue]")

        tests = [
            ("GET", "/api/v2/health", None, 200, "Main health check"),
            ("GET", "/api/health", None, 301, "Legacy health redirect"),
        ]

        for method, endpoint, data, expected, desc in tests:
            result = await self.test_endpoint(method, endpoint, data, expected, desc)
            status = "✅" if result["success"] else "❌"
            console.print(
                f"  {status} {desc}: {result['status_code']} ({result['duration']}s)"
            )

    async def test_mcp_system(self):
        """Test the new MCP registry system"""
        console.print("\n[bold magenta]🔌 Testing MCP Registry System[/bold magenta]")

        # Test MCP status (should show no server registered initially)
        result = await self.test_endpoint(
            "GET", "/api/v2/mcp/status", None, 200, "MCP status check"
        )
        status = "✅" if result["success"] else "❌"
        console.print(
            f"  {status} MCP Status: {result['status_code']} ({result['duration']}s)"
        )

        if result["success"]:
            mcp_data = result["response_data"]
            console.print(f"    Status: {mcp_data.get('status', 'unknown')}")
            console.print(f"    Available: {mcp_data.get('available', False)}")
            console.print(f"    Capabilities: {mcp_data.get('capabilities', [])}")

        # Test MCP registry status
        result = await self.test_endpoint(
            "GET", "/api/v2/mcp/registry/status", None, 200, "MCP registry status"
        )
        status = "✅" if result["success"] else "❌"
        console.print(
            f"  {status} Registry Status: {result['status_code']} ({result['duration']}s)"
        )

        # Test MCP server registration (this might fail if no MCP server is running)
        test_server_data = {
            "url": "http://localhost:8009/sse/",
            "validate_connection": False,  # Don't validate to avoid connection errors
        }

        result = await self.test_endpoint(
            "POST",
            "/api/v2/mcp/register",
            test_server_data,
            200,
            "MCP server registration",
        )
        status = "✅" if result["success"] else "⚠️"
        console.print(
            f"  {status} Server Registration: {result['status_code']} ({result['duration']}s)"
        )

        if not result["success"] and result.get("response_data"):
            console.print(
                f"    Note: {result['response_data'].get('detail', 'Registration failed')}"
            )

        # Test connection test endpoint
        result = await self.test_endpoint(
            "POST", "/api/v2/mcp/test-connection", None, 200, "MCP connection test"
        )
        status = "✅" if result["success"] else "⚠️"
        console.print(
            f"  {status} Connection Test: {result['status_code']} ({result['duration']}s)"
        )

    async def test_chat_endpoints(self):
        """Test chat management endpoints"""
        console.print("\n[bold green]💬 Testing Chat Management[/bold green]")

        # Create a new chat
        result = await self.test_endpoint(
            "POST", "/api/v2/chat/create", None, 200, "Create new chat"
        )
        status = "✅" if result["success"] else "❌"
        console.print(
            f"  {status} Create Chat: {result['status_code']} ({result['duration']}s)"
        )

        if result["success"]:
            self.chat_id = result["response_data"].get("id")
            console.print(f"    Chat ID: {self.chat_id}")

        # List chats
        result = await self.test_endpoint(
            "GET", "/api/v2/chats", None, 200, "List all chats"
        )
        status = "✅" if result["success"] else "❌"
        console.print(
            f"  {status} List Chats: {result['status_code']} ({result['duration']}s)"
        )

        if result["success"]:
            chats = result["response_data"]
            console.print(f"    Found {len(chats)} chats")

    async def test_chat_interactions(self):
        """Test chat interaction endpoints"""
        if not self.chat_id:
            console.print(
                "\n[yellow]⚠️ Skipping chat interactions - no chat ID available[/yellow]"
            )
            return

        console.print("\n[bold cyan]🤖 Testing Chat Interactions[/bold cyan]")

        # Test standard chat endpoint
        chat_data = {
            "messages": [
                {
                    "role": "user",
                    "content": "Hello, this is a test message",
                    "id": "test-1",
                }
            ],
            "model": "gpt-4o",
        }

        result = await self.test_endpoint(
            "POST", f"/api/v2/chat/{self.chat_id}", chat_data, 200, "Standard chat"
        )
        status = "✅" if result["success"] else "❌"
        console.print(
            f"  {status} Standard Chat: {result['status_code']} ({result['duration']}s)"
        )

        # Test MCP-enabled chat endpoint
        result = await self.test_endpoint(
            "POST",
            f"/api/v2/chat/{self.chat_id}/ai",
            chat_data,
            200,
            "MCP-enabled chat",
        )
        status = "✅" if result["success"] else "❌"
        console.print(
            f"  {status} MCP Chat: {result['status_code']} ({result['duration']}s)"
        )

        if result["success"] and "headers" in result:
            headers = result["headers"]
            mcp_headers = {
                k: v
                for k, v in headers.items()
                if k.lower().startswith("x-mcp") or k.lower().startswith("x-chat")
            }
            if mcp_headers:
                console.print("    MCP Headers:")
                for key, value in mcp_headers.items():
                    console.print(f"      {key}: {value}")

    async def test_message_operations(self):
        """Test message CRUD operations"""
        if not self.chat_id:
            console.print(
                "\n[yellow]⚠️ Skipping message operations - no chat ID available[/yellow]"
            )
            return

        console.print("\n[bold yellow]📝 Testing Message Operations[/bold yellow]")

        # Get messages
        result = await self.test_endpoint(
            "GET",
            f"/api/v2/chat/{self.chat_id}/messages",
            None,
            200,
            "Get chat messages",
        )
        status = "✅" if result["success"] else "❌"
        console.print(
            f"  {status} Get Messages: {result['status_code']} ({result['duration']}s)"
        )

        # Create a message
        message_data = {
            "role": "user",
            "content": "This is a test message created via API",
            "toolInvocations": [],
        }

        result = await self.test_endpoint(
            "POST",
            f"/api/v2/chat/{self.chat_id}/messages",
            message_data,
            200,
            "Create message",
        )
        status = "✅" if result["success"] else "❌"
        console.print(
            f"  {status} Create Message: {result['status_code']} ({result['duration']}s)"
        )

    async def test_legacy_redirects(self):
        """Test that legacy endpoints redirect to v2"""
        console.print("\n[bold red]🔄 Testing Legacy Redirects[/bold red]")

        redirects = [
            ("GET", "/api/health", "Health redirect", 301),
            ("POST", "/api/chat/create", "Chat create redirect", 301),
            ("GET", "/api/chats", "Chats list redirect", 301),
        ]

        for method, endpoint, desc, expected in redirects:
            result = await self.test_endpoint(method, endpoint, None, expected, desc)
            status = "✅" if result["success"] else "❌"
            console.print(
                f"  {status} {desc}: {result['status_code']} ({result['duration']}s)"
            )

    def print_summary(self):
        """Print a comprehensive test summary"""
        console.print("\n" + "=" * 80)
        console.print("[bold white]🧪 BACKEND TESTING SUMMARY[/bold white]")
        console.print("=" * 80)

        # Overall stats
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests

        stats_table = Table(title="Test Statistics")
        stats_table.add_column("Metric", style="cyan")
        stats_table.add_column("Value", style="magenta")

        stats_table.add_row("Total Tests", str(total_tests))
        stats_table.add_row("Passed", f"[green]{passed_tests}[/green]")
        stats_table.add_row("Failed", f"[red]{failed_tests}[/red]")
        stats_table.add_row("Success Rate", f"{(passed_tests/total_tests)*100:.1f}%")

        console.print(stats_table)

        # Detailed results
        results_table = Table(title="Detailed Test Results")
        results_table.add_column("Status", width=8)
        results_table.add_column("Method", width=8)
        results_table.add_column("Endpoint", width=30)
        results_table.add_column("Description", width=25)
        results_table.add_column("Code", width=8)
        results_table.add_column("Time", width=8)

        for result in self.results:
            status_icon = "✅" if result["success"] else "❌"
            status_color = "green" if result["success"] else "red"

            results_table.add_row(
                status_icon,
                result["method"],
                result["endpoint"],
                result["description"],
                f"[{status_color}]{result['status_code']}[/{status_color}]",
                f"{result['duration']}s",
            )

        console.print(results_table)

        # Failed tests details
        failed_results = [r for r in self.results if not r["success"]]
        if failed_results:
            console.print("\n[bold red]❌ Failed Tests Details:[/bold red]")
            for result in failed_results:
                console.print(f"\n[red]• {result['method']} {result['endpoint']}[/red]")
                console.print(f"  Description: {result['description']}")
                console.print(
                    f"  Expected: {result['expected_status']}, Got: {result['status_code']}"
                )
                if result.get("error"):
                    console.print(f"  Error: {result['error']}")
                elif result.get("response_data"):
                    console.print(
                        f"  Response: {json.dumps(result['response_data'], indent=2)[:200]}..."
                    )

    async def run_all_tests(self):
        """Run all test suites"""
        console.print(
            Panel.fit(
                "[bold white]🚀 WOOLLY BACKEND TESTING SUITE[/bold white]\n"
                "Testing all backend changes and MCP registry system",
                border_style="blue",
            )
        )

        # Wait for containers to be ready
        console.print("\n[yellow]⏳ Waiting for containers to be ready...[/yellow]")
        await asyncio.sleep(5)

        # Run all test suites
        await self.test_health_endpoints()
        await self.test_mcp_system()
        await self.test_chat_endpoints()
        await self.test_chat_interactions()
        await self.test_message_operations()
        await self.test_legacy_redirects()

        # Print summary
        self.print_summary()

        return len([r for r in self.results if r["success"]]), len(self.results)


async def main():
    """Main test runner"""
    tester = BackendTester()

    try:
        passed, total = await tester.run_all_tests()

        if passed == total:
            console.print(
                f"\n[bold green]🎉 ALL TESTS PASSED! ({passed}/{total})[/bold green]"
            )
            exit(0)
        else:
            console.print(
                f"\n[bold yellow]⚠️ SOME TESTS FAILED ({passed}/{total})[/bold yellow]"
            )
            exit(1)

    except KeyboardInterrupt:
        console.print("\n[yellow]Tests interrupted by user[/yellow]")
        exit(1)
    except Exception as e:
        console.print(f"\n[red]Test suite failed: {e}[/red]")
        exit(1)


if __name__ == "__main__":
    asyncio.run(main())
