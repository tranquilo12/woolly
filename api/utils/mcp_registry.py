"""
MCP Registry - Hot-Swap MCP Server Management

This module provides a thread-safe global registry for managing MCP server
instances that can be dynamically registered and deregistered at runtime.

Features:
- Thread-safe server registration/deregistration
- Global singleton pattern for consistent access
- Support for hot-swapping MCP servers without restart
- Graceful handling when no servers are registered
"""

import asyncio
import logging
from typing import Optional
from pydantic_ai.mcp import MCPServerStreamableHTTP

logger = logging.getLogger(__name__)


class MCPRegistry:
    """
    Thread-safe registry for managing active MCP server instances.

    Allows dynamic registration and deregistration of MCP servers
    without requiring application restart or agent recreation.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._active: Optional[MCPServerStreamableHTTP] = None
        self._url: Optional[str] = None

    async def register(self, server: MCPServerStreamableHTTP, url: str = None) -> None:
        """
        Register an active MCP server instance.

        Args:
            server: The MCP server instance to register
            url: Optional URL for tracking purposes
        """
        async with self._lock:
            self._active = server
            self._url = url
            logger.info(f"✅ MCP server registered: {url or 'unknown URL'}")

    async def deregister(self) -> None:
        """
        Deregister the current active MCP server.
        """
        async with self._lock:
            if self._active:
                logger.info(f"🔌 MCP server deregistered: {self._url or 'unknown URL'}")
            self._active = None
            self._url = None

    @property
    def active_server(self) -> Optional[MCPServerStreamableHTTP]:
        """
        Get the currently active MCP server instance.

        Returns:
            The active MCP server or None if no server is registered
        """
        return self._active

    @property
    def active_url(self) -> Optional[str]:
        """
        Get the URL of the currently active MCP server.

        Returns:
            The active MCP server URL or None if no server is registered
        """
        return self._url

    def is_active(self) -> bool:
        """
        Check if an MCP server is currently registered.

        Returns:
            True if a server is active, False otherwise
        """
        return self._active is not None


# Global registry instance - singleton pattern
_registry = MCPRegistry()


def get_mcp_registry() -> MCPRegistry:
    """
    Get the global MCP registry instance.

    Returns:
        The singleton MCPRegistry instance
    """
    return _registry
