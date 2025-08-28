"""
MCP Control Router - Hot-Swap MCP Server Management API

This router provides REST endpoints for dynamically registering and deregistering
MCP servers at runtime without requiring application restart.

Features:
- Register external MCP servers on-the-fly
- Deregister servers to disable MCP functionality
- Validate server connectivity before registration
- Provide status information about registered servers
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
from pydantic_ai.mcp import MCPServerStreamableHTTP

from ..utils.mcp_registry import get_mcp_registry
from ..agents.universal import get_universal_factory

logger = logging.getLogger(__name__)

router = APIRouter()


class MCPServerRegisterRequest(BaseModel):
    """Request model for MCP server registration"""

    url: str = Field(
        ..., description="MCP server URL (e.g., http://host.docker.internal:8009/sse/)"
    )
    validate_connection: bool = Field(
        True, description="Whether to validate connection before registering"
    )


class MCPServerResponse(BaseModel):
    """Response model for MCP server operations"""

    status: str
    message: str
    url: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


@router.post("/api/mcp/register", response_model=MCPServerResponse)
async def register_mcp_server(request: MCPServerRegisterRequest):
    """
    Register an external MCP server for hot-swap functionality.

    This endpoint allows dynamic registration of MCP servers without
    requiring application restart. The server will be used for all
    subsequent chat interactions.

    Args:
        request: MCP server registration request with URL and validation options

    Returns:
        MCPServerResponse with registration status and details

    Raises:
        HTTPException: If server validation fails or registration encounters errors
    """
    try:
        logger.info(f"🔌 Attempting to register MCP server: {request.url}")

        # Create MCP server instance
        mcp_server = MCPServerStreamableHTTP(request.url)

        # Validate connection if requested (default is True)
        if request.validate_connection:
            logger.info("🔍 Validating MCP server connection...")

            # Use the universal factory to test the connection
            factory = get_universal_factory()

            # Temporarily set the server for testing
            original_server = factory.mcp_server
            factory.mcp_server = mcp_server

            try:
                # Force the factory to use our test server
                factory.mcp_available = True
                factory._mcp_connection_tested = False  # Reset connection test flag

                # Test the connection
                test_result = await factory.test_mcp_connection()

                # For validation, we expect either success or a clear failure
                if test_result.get("connection_test") == "success":
                    logger.info("✅ MCP server validation successful")
                elif test_result.get("connection_test") == "disabled":
                    # This shouldn't happen during validation since we set a server
                    raise HTTPException(
                        status_code=400,
                        detail="MCP server validation failed: Server appears disabled during validation",
                    )
                else:
                    # Failed connection
                    raise HTTPException(
                        status_code=400,
                        detail=f"MCP server validation failed: {test_result.get('error', 'Connection failed')}",
                    )

            except HTTPException:
                # Re-raise HTTP exceptions (validation failures)
                raise
            except Exception as validation_error:
                logger.error(f"❌ MCP server validation failed: {validation_error}")
                raise HTTPException(
                    status_code=400,
                    detail=f"MCP server validation failed: {str(validation_error)}",
                )
            finally:
                # Restore original server and state
                factory.mcp_server = original_server
                factory.mcp_available = original_server is not None
                factory._mcp_connection_tested = False  # Reset for next use

        # Register the server in the global registry
        registry = get_mcp_registry()
        await registry.register(mcp_server, request.url)

        logger.info(f"✅ MCP server registered successfully: {request.url}")

        return MCPServerResponse(
            status="registered",
            message="MCP server registered successfully",
            url=request.url,
            details={
                "validation_performed": request.validate_connection,
                "server_type": "MCPServerStreamableHTTP",
                "registry_active": True,
            },
        )

    except HTTPException:
        # Re-raise HTTP exceptions (validation failures)
        raise
    except Exception as e:
        logger.error(f"❌ Failed to register MCP server {request.url}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to register MCP server: {str(e)}"
        )


@router.post("/api/mcp/deregister", response_model=MCPServerResponse)
async def deregister_mcp_server():
    """
    Deregister the currently active MCP server.

    This endpoint removes the active MCP server from the registry,
    effectively disabling MCP functionality for subsequent chat interactions.

    Returns:
        MCPServerResponse with deregistration status
    """
    try:
        registry = get_mcp_registry()

        # Check if there's an active server to deregister
        if not registry.is_active():
            return MCPServerResponse(
                status="no_action",
                message="No MCP server is currently registered",
                details={"registry_active": False},
            )

        # Get current server info before deregistering
        current_url = registry.active_url

        # Deregister the server
        await registry.deregister()

        logger.info(f"🔌 MCP server deregistered: {current_url}")

        return MCPServerResponse(
            status="deregistered",
            message="MCP server deregistered successfully",
            url=current_url,
            details={"previous_url": current_url, "registry_active": False},
        )

    except Exception as e:
        logger.error(f"❌ Failed to deregister MCP server: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to deregister MCP server: {str(e)}"
        )


@router.get("/api/mcp/registry/status", response_model=MCPServerResponse)
async def get_registry_status():
    """
    Get the current status of the MCP registry.

    This endpoint provides information about the currently registered
    MCP server and registry state.

    Returns:
        MCPServerResponse with current registry status and details
    """
    try:
        registry = get_mcp_registry()

        if registry.is_active():
            return MCPServerResponse(
                status="active",
                message="MCP server is registered and active",
                url=registry.active_url,
                details={
                    "registry_active": True,
                    "server_url": registry.active_url,
                    "server_type": "MCPServerStreamableHTTP",
                },
            )
        else:
            return MCPServerResponse(
                status="inactive",
                message="No MCP server is currently registered",
                details={"registry_active": False, "server_url": None},
            )

    except Exception as e:
        logger.error(f"❌ Failed to get registry status: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get registry status: {str(e)}"
        )


@router.post("/api/mcp/test-connection")
async def test_mcp_connection():
    """
    Test the connection to the currently registered MCP server.

    This endpoint performs a connection test using the Universal Agent Factory
    to verify that the registered MCP server is accessible and functional.

    Returns:
        Dict with connection test results and details
    """
    try:
        registry = get_mcp_registry()

        if not registry.is_active():
            raise HTTPException(
                status_code=400,
                detail="No MCP server is currently registered. Register a server first.",
            )

        # Use the universal factory to test the connection
        factory = get_universal_factory()

        # Ensure the factory uses the registered server
        factory.refresh_mcp()

        # Perform the connection test
        test_result = await factory.test_mcp_connection()

        return {
            "registry_url": registry.active_url,
            "test_result": test_result,
            "timestamp": "now",  # Could use datetime.now().isoformat()
        }

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"❌ MCP connection test failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"MCP connection test failed: {str(e)}"
        )
