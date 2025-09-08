#!/usr/bin/env python3
"""
Pydantic AI to FastMCP Adapter
=============================

This adapter bridges the gap between Pydantic AI's MCP client expectations
and FastMCP's HTTP-based server implementation.

Problem:
- Pydantic AI expects MCP servers to follow specific transport protocols
- FastMCP servers expose tools via HTTP endpoints with different patterns
- Direct connection fails with "TaskGroup" errors

Solution:
- Create an adapter that translates Pydantic AI MCP calls to FastMCP HTTP requests
- Maintain compatibility with existing Pydantic AI agent patterns
- Enable seamless integration without major refactoring
"""

import asyncio
import json
import logging
from typing import Dict, Any, List, Optional, Union
from datetime import datetime

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class FastMCPTool(BaseModel):
    """Represents a tool available on the FastMCP server"""

    name: str
    description: str
    input_schema: Dict[str, Any]


class FastMCPResponse(BaseModel):
    """Standardized response from FastMCP operations"""

    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    tools: Optional[List[FastMCPTool]] = None


class PydanticToFastMCPAdapter:
    """
    Adapter that makes FastMCP servers compatible with Pydantic AI MCP clients.

    This adapter:
    1. Translates Pydantic AI MCP connection patterns to FastMCP HTTP calls
    2. Provides a Pydantic AI-compatible interface for FastMCP servers
    3. Handles connection validation, tool discovery, and tool execution
    4. Maintains async patterns expected by Pydantic AI agents
    """

    def __init__(self, fastmcp_server_url: str):
        """
        Initialize the adapter with a FastMCP server URL.

        Args:
            fastmcp_server_url: URL of the FastMCP server (e.g., "http://localhost:8009/sse/")
        """
        self.server_url = fastmcp_server_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=30.0)
        self.available_tools: List[FastMCPTool] = []
        self.connection_tested = False

    async def __aenter__(self):
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.client.aclose()

    async def test_connection(self) -> FastMCPResponse:
        """
        Test connection to the FastMCP server.

        This method attempts to connect to the FastMCP server and verify
        it's responding correctly. It's designed to replace the failing
        Pydantic AI MCP connection test.

        Returns:
            FastMCPResponse with connection test results
        """
        try:
            logger.info(f"🔍 Testing FastMCP server connection: {self.server_url}")

            # Try to get server health/status
            response = await self.client.get(f"{self.server_url}/health")

            if response.status_code == 200:
                health_data = response.json()
                logger.info("✅ FastMCP server health check passed")

                # Try to discover available tools
                tools_response = await self.discover_tools()
                if tools_response.success:
                    self.connection_tested = True
                    return FastMCPResponse(
                        success=True,
                        data={
                            "server_url": self.server_url,
                            "health": health_data,
                            "tools_count": len(tools_response.tools or []),
                            "connection_method": "HTTP",
                            "adapter_version": "1.0.0",
                        },
                    )
                else:
                    return FastMCPResponse(
                        success=False,
                        error=f"Health check passed but tool discovery failed: {tools_response.error}",
                    )
            else:
                return FastMCPResponse(
                    success=False,
                    error=f"Health check failed: HTTP {response.status_code}",
                )

        except httpx.ConnectError as e:
            logger.warning(f"❌ FastMCP server connection failed: {e}")
            return FastMCPResponse(success=False, error=f"Connection failed: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Unexpected error testing FastMCP connection: {e}")
            return FastMCPResponse(success=False, error=f"Unexpected error: {str(e)}")

    async def discover_tools(self) -> FastMCPResponse:
        """
        Discover available tools on the FastMCP server.

        Returns:
            FastMCPResponse with list of available tools
        """
        try:
            # FastMCP servers typically expose tools via a tools endpoint
            # or through the root endpoint with tool listing

            # Try common FastMCP tool discovery endpoints
            endpoints_to_try = [
                "/tools",
                "/list_tools",
                "/mcp/tools",
                "/",  # Some FastMCP servers list tools at root
            ]

            for endpoint in endpoints_to_try:
                try:
                    response = await self.client.get(f"{self.server_url}{endpoint}")
                    if response.status_code == 200:
                        data = response.json()

                        # Parse tools from response (format may vary)
                        tools = self._parse_tools_from_response(data)
                        if tools:
                            self.available_tools = tools
                            logger.info(
                                f"✅ Discovered {len(tools)} tools from {endpoint}"
                            )
                            return FastMCPResponse(
                                success=True,
                                tools=tools,
                                data={"endpoint_used": endpoint, "raw_response": data},
                            )

                except httpx.HTTPStatusError:
                    continue  # Try next endpoint

            # If no tools found via standard endpoints, return empty but successful
            logger.warning("⚠️ No tools discovered via standard endpoints")
            return FastMCPResponse(
                success=True,
                tools=[],
                data={"message": "No tools found via standard discovery methods"},
            )

        except Exception as e:
            logger.error(f"❌ Tool discovery failed: {e}")
            return FastMCPResponse(
                success=False, error=f"Tool discovery failed: {str(e)}"
            )

    def _parse_tools_from_response(self, data: Dict[str, Any]) -> List[FastMCPTool]:
        """
        Parse tools from various FastMCP response formats.

        Args:
            data: Raw response data from FastMCP server

        Returns:
            List of FastMCPTool objects
        """
        tools = []

        # Common FastMCP response formats
        if isinstance(data, dict):
            # Format 1: {"tools": [...]}
            if "tools" in data and isinstance(data["tools"], list):
                for tool_data in data["tools"]:
                    if isinstance(tool_data, dict) and "name" in tool_data:
                        tools.append(
                            FastMCPTool(
                                name=tool_data.get("name", ""),
                                description=tool_data.get("description", ""),
                                input_schema=tool_data.get("input_schema", {}),
                            )
                        )

            # Format 2: Direct tool list
            elif isinstance(data, list):
                for tool_data in data:
                    if isinstance(tool_data, dict) and "name" in tool_data:
                        tools.append(
                            FastMCPTool(
                                name=tool_data.get("name", ""),
                                description=tool_data.get("description", ""),
                                input_schema=tool_data.get("input_schema", {}),
                            )
                        )

        return tools

    async def call_tool(
        self, tool_name: str, arguments: Dict[str, Any]
    ) -> FastMCPResponse:
        """
        Call a tool on the FastMCP server.

        Args:
            tool_name: Name of the tool to call
            arguments: Arguments to pass to the tool

        Returns:
            FastMCPResponse with tool execution results
        """
        try:
            # FastMCP servers typically accept tool calls via POST
            payload = {"tool": tool_name, "arguments": arguments}

            # Try common FastMCP tool execution endpoints
            endpoints_to_try = [
                f"/tools/{tool_name}",
                f"/call_tool",
                f"/mcp/call_tool",
                f"/execute/{tool_name}",
            ]

            for endpoint in endpoints_to_try:
                try:
                    response = await self.client.post(
                        f"{self.server_url}{endpoint}", json=payload
                    )

                    if response.status_code == 200:
                        result = response.json()
                        logger.info(
                            f"✅ Tool '{tool_name}' executed successfully via {endpoint}"
                        )
                        return FastMCPResponse(success=True, data=result)

                except httpx.HTTPStatusError:
                    continue  # Try next endpoint

            return FastMCPResponse(
                success=False,
                error=f"Tool '{tool_name}' not found or not callable on any endpoint",
            )

        except Exception as e:
            logger.error(f"❌ Tool execution failed: {e}")
            return FastMCPResponse(
                success=False, error=f"Tool execution failed: {str(e)}"
            )

    async def get_server_info(self) -> FastMCPResponse:
        """
        Get information about the FastMCP server.

        Returns:
            FastMCPResponse with server information
        """
        try:
            connection_test = await self.test_connection()

            if connection_test.success:
                return FastMCPResponse(
                    success=True,
                    data={
                        "server_url": self.server_url,
                        "server_type": "FastMCP",
                        "adapter_type": "PydanticToFastMCP",
                        "connection_status": "active",
                        "tools_available": len(self.available_tools),
                        "tools": [tool.name for tool in self.available_tools],
                        "last_tested": datetime.now().isoformat(),
                    },
                )
            else:
                return FastMCPResponse(
                    success=False,
                    error=f"Server info unavailable: {connection_test.error}",
                )

        except Exception as e:
            return FastMCPResponse(
                success=False, error=f"Failed to get server info: {str(e)}"
            )


class PydanticAICompatibleMCPServer:
    """
    Wrapper that makes the FastMCP adapter compatible with Pydantic AI's MCP expectations.

    This class provides the interface that Pydantic AI agents expect from MCP servers,
    but internally uses the FastMCP adapter to communicate with the actual server.
    """

    def __init__(self, fastmcp_server_url: str):
        self.adapter = PydanticToFastMCPAdapter(fastmcp_server_url)
        self.server_url = fastmcp_server_url

    async def __aenter__(self):
        """Async context manager for Pydantic AI compatibility"""
        await self.adapter.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager cleanup"""
        await self.adapter.__aexit__(exc_type, exc_val, exc_tb)

    async def test_connection(self) -> bool:
        """
        Simple connection test that returns boolean (Pydantic AI style).

        Returns:
            True if connection successful, False otherwise
        """
        result = await self.adapter.test_connection()
        return result.success

    async def list_tools(self) -> List[str]:
        """
        List available tool names (Pydantic AI style).

        Returns:
            List of tool names
        """
        result = await self.adapter.discover_tools()
        if result.success and result.tools:
            return [tool.name for tool in result.tools]
        return []

    async def call_tool(self, tool_name: str, **kwargs) -> Any:
        """
        Call a tool with keyword arguments (Pydantic AI style).

        Args:
            tool_name: Name of the tool to call
            **kwargs: Tool arguments

        Returns:
            Tool execution result
        """
        result = await self.adapter.call_tool(tool_name, kwargs)
        if result.success:
            return result.data
        else:
            raise Exception(f"Tool call failed: {result.error}")


# Convenience function for creating the adapter
async def create_fastmcp_adapter(server_url: str) -> PydanticToFastMCPAdapter:
    """
    Create and test a FastMCP adapter.

    Args:
        server_url: URL of the FastMCP server

    Returns:
        Configured and tested adapter

    Raises:
        Exception if connection test fails
    """
    adapter = PydanticToFastMCPAdapter(server_url)

    async with adapter:
        connection_result = await adapter.test_connection()
        if not connection_result.success:
            raise Exception(
                f"FastMCP adapter connection failed: {connection_result.error}"
            )

    return adapter


# Convenience function for Pydantic AI integration
def create_pydantic_ai_compatible_server(
    server_url: str,
) -> PydanticAICompatibleMCPServer:
    """
    Create a Pydantic AI compatible MCP server wrapper.

    Args:
        server_url: URL of the FastMCP server

    Returns:
        Pydantic AI compatible server wrapper
    """
    return PydanticAICompatibleMCPServer(server_url)
