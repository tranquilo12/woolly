import os
from datetime import datetime
from typing import Any, Dict

from sqlalchemy import text

from .database import SessionLocal
from .mcp_status import get_mcp_status_service


class HealthService:
    """Unified health service returning comprehensive system status."""

    async def get_comprehensive_status(self) -> Dict[str, Any]:
        components = {
            "database": await self._check_database(),
            "mcp_server": await self._check_mcp(),
            "agents": await self._check_agents(),
            "triage": await self._check_triage(),
            "openai": await self._check_openai(),
        }

        overall_status = "healthy"
        for comp in components.values():
            if comp.get("status") == "failed":
                overall_status = "unhealthy"
                break
            if (
                comp.get("status") in ("degraded", "warning")
                and overall_status != "unhealthy"
            ):
                overall_status = "degraded"

        return {
            "status": overall_status,
            "timestamp": datetime.now().isoformat(),
            "version": os.getenv("APP_VERSION", "2.0.0"),
            "components": components,
            "endpoints": {
                "chat": "/api/v2/chat/{id}",
                "agents": "/api/v2/agents/execute",
                "triage": "/api/v2/triage/analyze",
                "mcp_status": "/api/v2/mcp/status",
            },
        }

    async def _check_database(self) -> Dict[str, Any]:
        try:
            session = SessionLocal()
            try:
                session.execute(text("SELECT 1"))
                return {"status": "healthy"}
            finally:
                session.close()
        except Exception as e:
            return {"status": "failed", "error": str(e)}

    async def _check_mcp(self) -> Dict[str, Any]:
        try:
            service = get_mcp_status_service()
            status = service.get_status()
            return {
                "status": status.status.value,
                "available": status.available,
                "capabilities": status.capabilities,
                "fallback_mode": status.fallback_mode,
            }
        except Exception as e:
            return {"status": "failed", "error": str(e)}

    async def _check_agents(self) -> Dict[str, Any]:
        try:
            # Lazy import to avoid heavy startup
            from ..agents.universal import get_universal_factory

            factory = get_universal_factory()
            # If factory returns without exception, consider healthy
            return {"status": "healthy", "factory_initialized": factory is not None}
        except Exception as e:
            return {"status": "failed", "error": str(e)}

    async def _check_triage(self) -> Dict[str, Any]:
        try:
            # Import without instantiation to avoid side-effects if any
            from ..agents.triage import TriageAgent  # noqa: F401

            return {"status": "healthy"}
        except Exception as e:
            return {"status": "failed", "error": str(e)}

    async def _check_openai(self) -> Dict[str, Any]:
        try:
            api_key_present = bool(os.getenv("OPENAI_API_KEY"))
            if not api_key_present:
                return {"status": "warning", "message": "OPENAI_API_KEY not set"}
            return {"status": "healthy"}
        except Exception as e:
            return {"status": "failed", "error": str(e)}
