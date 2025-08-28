"""
MCP Status Service - Graceful MCP Server State Management

This module provides comprehensive MCP server status tracking and graceful
fallback handling for the frontend and chat endpoints.

Features:
- Real-time MCP server health monitoring
- Graceful fallback when MCP unavailable
- Frontend-friendly status exposure
- Automatic retry logic with backoff
- Detailed error reporting and diagnostics
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from enum import Enum
from dataclasses import dataclass, field
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class MCPStatus(str, Enum):
    """MCP server status states"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    FAILED = "failed"
    UNKNOWN = "unknown"
    CONNECTING = "connecting"
    RETRYING = "retrying"


class MCPCapability(str, Enum):
    """Available MCP capabilities"""

    SEARCH_CODE = "search_code"
    FIND_ENTITIES = "find_entities"
    GET_ENTITY_RELATIONSHIPS = "get_entity_relationships"
    QA_CODEBASE = "qa_codebase"
    GENERATE_DIAGRAM = "generate_diagram"


@dataclass
class MCPServerInfo:
    """MCP server information and status"""

    url: str
    status: MCPStatus = MCPStatus.UNKNOWN
    last_check: Optional[datetime] = None
    last_success: Optional[datetime] = None
    error_count: int = 0
    consecutive_failures: int = 0
    capabilities: List[MCPCapability] = field(default_factory=list)
    version: Optional[str] = None
    response_time_ms: Optional[float] = None
    error_message: Optional[str] = None


class MCPStatusResponse(BaseModel):
    """Frontend-friendly MCP status response"""

    status: MCPStatus
    available: bool
    capabilities: List[str]
    server_info: Dict[str, Any]
    fallback_mode: bool
    last_check: Optional[str] = None
    next_retry: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None


class MCPStatusService:
    """
    Service for tracking and managing MCP server status

    Provides real-time status monitoring, graceful fallbacks,
    and frontend-friendly status information.
    """

    def __init__(self):
        self.server_info = MCPServerInfo(url="http://localhost:8009/sse/")
        self.check_interval = 30  # seconds
        self.max_consecutive_failures = 3
        self.retry_backoff_base = 2  # exponential backoff base
        self.max_retry_delay = 300  # max 5 minutes
        self._monitoring_task: Optional[asyncio.Task] = None
        self._factory_instance = None

    async def start_monitoring(self):
        """Start background MCP status monitoring"""
        if self._monitoring_task is None or self._monitoring_task.done():
            self._monitoring_task = asyncio.create_task(self._monitor_loop())
            logger.info("🔍 Started MCP status monitoring")

    async def stop_monitoring(self):
        """Stop background MCP status monitoring"""
        if self._monitoring_task and not self._monitoring_task.done():
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
            logger.info("⏹️ Stopped MCP status monitoring")

    async def _monitor_loop(self):
        """Background monitoring loop"""
        while True:
            try:
                await self.check_status()

                # Calculate next check interval based on status
                if self.server_info.status == MCPStatus.HEALTHY:
                    delay = self.check_interval
                elif self.server_info.status == MCPStatus.DEGRADED:
                    delay = self.check_interval // 2  # Check more frequently
                else:
                    # Exponential backoff for failed connections
                    delay = min(
                        self.retry_backoff_base**self.server_info.consecutive_failures,
                        self.max_retry_delay,
                    )

                await asyncio.sleep(delay)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"MCP monitoring error: {e}")
                await asyncio.sleep(self.check_interval)

    async def check_status(self) -> MCPStatus:
        """
        Check MCP server status and update internal state

        Returns:
            Current MCP status
        """
        start_time = datetime.now()
        self.server_info.last_check = start_time

        try:
            # Get factory instance
            if self._factory_instance is None:
                from ..agents.universal import get_universal_factory

                self._factory_instance = get_universal_factory()

            # Test MCP connection through the factory
            test_result = await self._factory_instance.test_mcp_connection()

            # Calculate response time
            response_time = (datetime.now() - start_time).total_seconds() * 1000
            self.server_info.response_time_ms = response_time

            if test_result.get("connection_test") == "success":
                # Success - reset failure counters
                self.server_info.status = MCPStatus.HEALTHY
                self.server_info.last_success = datetime.now()
                self.server_info.consecutive_failures = 0
                self.server_info.error_message = None

                # Extract capabilities and version info
                self._update_server_capabilities(test_result)

                logger.debug(f"✅ MCP server healthy (response: {response_time:.1f}ms)")

            else:
                # Partial failure - degraded state
                self.server_info.status = MCPStatus.DEGRADED
                self.server_info.consecutive_failures += 1
                self.server_info.error_count += 1
                self.server_info.error_message = test_result.get(
                    "error", "Unknown degradation"
                )

                logger.warning(
                    f"⚠️ MCP server degraded: {self.server_info.error_message}"
                )

        except Exception as e:
            # Complete failure
            self.server_info.status = MCPStatus.FAILED
            self.server_info.consecutive_failures += 1
            self.server_info.error_count += 1
            self.server_info.error_message = str(e)
            self.server_info.response_time_ms = None

            logger.error(f"❌ MCP server failed: {e}")

        return self.server_info.status

    def _update_server_capabilities(self, test_result: Dict[str, Any]):
        """Update server capabilities from test result"""
        # Extract available capabilities from test result
        capabilities = []

        # Default MCP capabilities (can be enhanced based on actual server response)
        if test_result.get("connection_test") == "success":
            capabilities = [
                MCPCapability.SEARCH_CODE,
                MCPCapability.FIND_ENTITIES,
                MCPCapability.GET_ENTITY_RELATIONSHIPS,
                MCPCapability.QA_CODEBASE,
                MCPCapability.GENERATE_DIAGRAM,
            ]

        self.server_info.capabilities = capabilities

        # Extract version info if available
        if "server_version" in test_result:
            self.server_info.version = test_result["server_version"]

    def get_status(self) -> MCPStatusResponse:
        """
        Get current MCP status in frontend-friendly format

        Returns:
            MCPStatusResponse with current status and details
        """
        # Determine if MCP is available for use
        available = self.server_info.status in [MCPStatus.HEALTHY, MCPStatus.DEGRADED]
        fallback_mode = self.server_info.status != MCPStatus.HEALTHY

        # Calculate next retry time for failed connections
        next_retry = None
        if self.server_info.status == MCPStatus.FAILED and self.server_info.last_check:
            retry_delay = min(
                self.retry_backoff_base**self.server_info.consecutive_failures,
                self.max_retry_delay,
            )
            next_retry = (
                self.server_info.last_check + timedelta(seconds=retry_delay)
            ).isoformat()

        # Prepare error details
        error_details = None
        if self.server_info.error_message:
            error_details = {
                "message": self.server_info.error_message,
                "error_count": self.server_info.error_count,
                "consecutive_failures": self.server_info.consecutive_failures,
                "last_success": (
                    self.server_info.last_success.isoformat()
                    if self.server_info.last_success
                    else None
                ),
            }

        return MCPStatusResponse(
            status=self.server_info.status,
            available=available,
            capabilities=[cap.value for cap in self.server_info.capabilities],
            fallback_mode=fallback_mode,
            server_info={
                "url": self.server_info.url,
                "version": self.server_info.version,
                "response_time_ms": self.server_info.response_time_ms,
                "last_check": (
                    self.server_info.last_check.isoformat()
                    if self.server_info.last_check
                    else None
                ),
            },
            last_check=(
                self.server_info.last_check.isoformat()
                if self.server_info.last_check
                else None
            ),
            next_retry=next_retry,
            error_details=error_details,
        )

    def is_available(self) -> bool:
        """Check if MCP server is available for use"""
        return self.server_info.status in [MCPStatus.HEALTHY, MCPStatus.DEGRADED]

    def should_use_fallback(self) -> bool:
        """Check if fallback mode should be used"""
        return self.server_info.status != MCPStatus.HEALTHY

    def get_capabilities(self) -> List[str]:
        """Get list of available MCP capabilities"""
        return [cap.value for cap in self.server_info.capabilities]

    async def force_check(self) -> MCPStatus:
        """Force an immediate status check"""
        return await self.check_status()


# Global MCP status service instance
_mcp_status_service: Optional[MCPStatusService] = None


def get_mcp_status_service() -> MCPStatusService:
    """Get the global MCP status service instance"""
    global _mcp_status_service
    if _mcp_status_service is None:
        _mcp_status_service = MCPStatusService()
    return _mcp_status_service


async def initialize_mcp_monitoring():
    """Initialize and start MCP status monitoring"""
    service = get_mcp_status_service()
    await service.start_monitoring()
    logger.info("🚀 MCP status monitoring initialized")


async def shutdown_mcp_monitoring():
    """Shutdown MCP status monitoring"""
    service = get_mcp_status_service()
    await service.stop_monitoring()
    logger.info("🛑 MCP status monitoring shutdown")
