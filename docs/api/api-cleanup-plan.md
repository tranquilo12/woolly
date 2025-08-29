# Woolly API Cleanup & Polish Plan

_Based on: [endpoints-analysis.md](./endpoints-analysis.md)_  
_Target: Improved Developer Experience & API Organization_

## Overview

The Woolly API is functionally excellent with robust MCP integration and agent pipeline capabilities. This plan focuses on **organizational cleanup** and **developer experience improvements** through systematic endpoint restructuring.

**Current Status**: ✅ Core functionality complete, ⚠️ Needs organizational polish  
**Impact**: Primarily developer experience - no breaking changes to core features  
**Timeline**: 4 phases, can be implemented incrementally

---

## Phase 1: API Versioning Standardization

<details>
<summary><strong>🎯 Goal: Consistent /api/v2/* prefix across all endpoints</strong></summary>

### Current Issues

- Mixed prefixes: `/api/`, `/api/v1/`, and no prefix
- Inconsistent router organization
- Confusing endpoint discovery

### Changes Required

#### 1.1 Router Prefix Updates

```diff
# api/index.py
- app.include_router(agents.router, prefix="/api")
- app.include_router(universal_agents.router, prefix="/api/v1", tags=["universal-agents"])
- app.include_router(triage.router, prefix="/api/v1", tags=["triage-agents"])
- app.include_router(streaming_poc.router, tags=["streaming-poc"])
- app.include_router(mcp_control.router, tags=["mcp-control"])

+ app.include_router(agents.router, prefix="/api/v2", tags=["agents"])
+ app.include_router(universal_agents.router, prefix="/api/v2", tags=["agents"])
+ app.include_router(triage.router, prefix="/api/v2", tags=["triage"])
+ app.include_router(mcp_control.router, prefix="/api/v2", tags=["mcp"])
+ app.include_router(dev_tools.router, prefix="/api/v2/dev", tags=["development"])
```

#### 1.2 Main App Endpoints

```diff
# api/index.py - Update all @app decorators
- @app.get("/api/health")
- @app.post("/api/chat/create")
- @app.get("/api/chats")
- @app.post("/api/chat/{chat_id}")
- @app.get("/api/mcp/status")

+ @app.get("/api/v2/health")
+ @app.post("/api/v2/chat/create")
+ @app.get("/api/v2/chats")
+ @app.post("/api/v2/chat/{chat_id}")
+ @app.get("/api/v2/mcp/status")
```

#### 1.3 Backward Compatibility

```python
# Add legacy route redirects
@app.get("/api/health")
async def legacy_health():
    return RedirectResponse("/api/v2/health", status_code=301)

@app.post("/api/v1/agents/execute")
async def legacy_agents_execute():
    return RedirectResponse("/api/v2/agents/execute", status_code=301)
```

### Expected Results

- ✅ All endpoints accessible via `/api/v2/*`
- ✅ Consistent API documentation
- ✅ Easier frontend integration
- ✅ Backward compatibility maintained

### Files to Modify

- `api/index.py` (router includes + endpoint decorators)
- `api/routers/*.py` (remove conflicting prefixes)
- Frontend API clients (update base URLs)

### Testing Checklist

- [ ] All endpoints respond at new `/api/v2/*` URLs
- [ ] Legacy redirects work correctly
- [ ] Frontend continues to function
- [ ] API documentation generates correctly

</details>

---

## Phase 2: Health Check Consolidation

<details>
<summary><strong>🏥 Goal: Single comprehensive health endpoint with component status</strong></summary>

### Current Issues

- 4 separate health endpoints: `/api/health`, `/api/agents/health`, `/api/v1/agents/health`, `/api/v1/triage/health`
- Redundant health checking logic
- Difficult to get overall system status

### Changes Required

#### 2.1 Create Unified Health Service

```python
# api/utils/health_service.py
class HealthService:
    async def get_comprehensive_status(self) -> Dict[str, Any]:
        return {
            "status": "healthy",  # healthy | degraded | unhealthy
            "timestamp": datetime.now().isoformat(),
            "version": "2.0.0",
            "components": {
                "database": await self._check_database(),
                "mcp_server": await self._check_mcp(),
                "agents": await self._check_agents(),
                "triage": await self._check_triage(),
                "openai": await self._check_openai()
            },
            "endpoints": {
                "chat": "/api/v2/chat/{id}",
                "agents": "/api/v2/agents/execute",
                "triage": "/api/v2/triage/analyze",
                "mcp_status": "/api/v2/mcp/status"
            }
        }
```

#### 2.2 Replace Multiple Health Endpoints

```diff
# Remove from routers
- @router.get("/agents/health")  # agents.py
- @router.get("/agents/health")  # universal_agents.py
- @router.get("/triage/health")  # triage.py

# Single endpoint in index.py
+ @app.get("/api/v2/health")
+ async def comprehensive_health():
+     health_service = HealthService()
+     return await health_service.get_comprehensive_status()
```

#### 2.3 Component-Specific Health Checks

```python
# Optional: Keep component-specific endpoints for debugging
@app.get("/api/v2/health/mcp")
async def mcp_health():
    return await HealthService()._check_mcp()

@app.get("/api/v2/health/agents")
async def agents_health():
    return await HealthService()._check_agents()
```

### Expected Results

- ✅ Single source of truth for system health
- ✅ Comprehensive component status in one call
- ✅ Better monitoring and alerting capabilities
- ✅ Reduced redundant health check code

### Files to Modify

- `api/utils/health_service.py` (new file)
- `api/index.py` (unified health endpoint)
- `api/routers/agents.py` (remove health endpoint)
- `api/routers/universal_agents.py` (remove health endpoint)
- `api/routers/triage.py` (remove health endpoint)

### Testing Checklist

- [ ] `/api/v2/health` returns comprehensive status
- [ ] All component checks work correctly
- [ ] Health status accurately reflects system state
- [ ] Frontend health monitoring works

</details>

---

## Phase 3: Legacy Endpoint Removal

<details>
<summary><strong>🗑️ Goal: Remove deprecated and broken endpoints</strong></summary>

### Current Issues

- Broken endpoints still exposed: `/api/strategies/*`
- Deprecated functionality: `/api/generate/{specialization}`
- Unused system prompts endpoint: `/api/docs_system_prompt.txt`
- Confusing endpoint proliferation

### Changes Required

#### 3.1 Remove Broken Endpoints

```diff
# api/routers/documentation.py - Remove entirely or fix
- @router.get("/strategies", response_model=List[Dict])
- @router.get("/strategies/{strategy_name}")

# These endpoints return errors - remove router inclusion
- app.include_router(documentation.router, prefix="/api")
```

#### 3.2 Remove Deprecated Endpoints

```diff
# api/routers/agents.py
- @router.post("/generate/{specialization}")
# This was replaced by universal agent system

# api/index.py
- @app.get("/api/docs_system_prompt.txt")
# Move to organized system management if needed
```

#### 3.3 Handle System Prompts Properly

```python
# If system prompts are still needed, organize them:
@app.get("/api/v2/system/prompts/{prompt_name}")
async def get_system_prompt(prompt_name: str):
    # Serve from organized prompt directory
    pass
```

#### 3.4 Add Deprecation Notices (Before Removal)

```python
# Temporary: Add deprecation warnings
@router.post("/generate/{specialization}")
async def deprecated_generate():
    raise HTTPException(
        status_code=410,
        detail={
            "error": "Endpoint deprecated",
            "message": "Use /api/v2/agents/execute instead",
            "migration_guide": "/docs/migration"
        }
    )
```

### Expected Results

- ✅ Cleaner API surface area
- ✅ No broken endpoints exposed
- ✅ Clear migration path for deprecated features
- ✅ Reduced maintenance burden

### Files to Modify

- `api/routers/documentation.py` (remove or fix)
- `api/routers/agents.py` (remove deprecated generate)
- `api/index.py` (remove docs_system_prompt.txt)
- `api/index.py` (remove documentation router inclusion)

### Testing Checklist

- [ ] Broken endpoints no longer accessible
- [ ] Deprecated endpoints return proper error messages
- [ ] No 404s on removed endpoints (should be 410 Gone)
- [ ] API documentation updated

</details>

---

## Phase 4: Development Tools Organization

<details>
<summary><strong>🛠️ Goal: Organize development/testing endpoints under /api/v2/dev/*</strong></summary>

### Current Issues

- Streaming test endpoints have no prefix: `/mock`, `/test`
- MCP control endpoints scattered
- No clear separation of production vs development endpoints

### Changes Required

#### 4.1 Create Development Router

```python
# api/routers/dev_tools.py (new file)
router = APIRouter()

@router.post("/streaming/mock")
async def mock_streaming():
    # Move from streaming_poc.py
    pass

@router.get("/streaming/test")
async def test_streaming():
    # Move from streaming_poc.py
    pass

@router.get("/mcp/diagnostics")
async def mcp_diagnostics():
    # Enhanced MCP debugging info
    pass
```

#### 4.2 Move MCP Control to Organized Structure

```diff
# Current scattered MCP endpoints:
- /api/mcp/register
- /api/mcp/deregister
- /api/mcp/test-connection
- /api/v1/agents/mcp/test

# Organized under:
+ /api/v2/mcp/register
+ /api/v2/mcp/deregister
+ /api/v2/mcp/test-connection
+ /api/v2/mcp/diagnostics
```

#### 4.3 Update Router Organization

```diff
# api/index.py
- app.include_router(streaming_poc.router, tags=["streaming-poc"])
- app.include_router(mcp_control.router, tags=["mcp-control"])

+ app.include_router(dev_tools.router, prefix="/api/v2/dev", tags=["development"])
+ app.include_router(mcp_control.router, prefix="/api/v2", tags=["mcp"])
```

#### 4.4 Add Development Mode Detection

```python
# Only expose dev endpoints in development
if os.getenv("ENVIRONMENT") != "production":
    app.include_router(dev_tools.router, prefix="/api/v2/dev", tags=["development"])
```

### Expected Results

- ✅ Clear separation of production vs development endpoints
- ✅ Organized MCP management endpoints
- ✅ Better development experience
- ✅ Production deployments don't expose dev tools

### Files to Modify

- `api/routers/dev_tools.py` (new file)
- `api/routers/streaming_poc.py` (move endpoints or remove)
- `api/routers/mcp_control.py` (remove prefixes)
- `api/index.py` (update router organization)

### Testing Checklist

- [ ] Dev endpoints accessible at `/api/v2/dev/*`
- [ ] MCP endpoints organized under `/api/v2/mcp/*`
- [ ] Production mode hides dev endpoints
- [ ] All functionality preserved

</details>

---

## Implementation Strategy

### Rollout Approach

1. **Phase 1** (Versioning) - Can be done immediately with redirects
2. **Phase 2** (Health) - Independent, can be done in parallel
3. **Phase 3** (Cleanup) - Should follow Phase 1 for consistency
4. **Phase 4** (Dev Tools) - Can be done anytime, low risk

### Frontend Migration

```typescript
// Update API client base URL
const API_BASE = process.env.NODE_ENV === "production" ? "/api/v2" : "/api/v2"; // v2 for both now

// Update specific endpoints
const ENDPOINTS = {
  chat: (id: string) => `${API_BASE}/chat/${id}`,
  agents: `${API_BASE}/agents/execute`,
  triage: `${API_BASE}/triage/analyze`,
  health: `${API_BASE}/health`,
};
```

### Risk Mitigation

- **Backward compatibility**: Keep redirects for 1-2 releases
- **Gradual rollout**: Implement phases independently
- **Testing**: Comprehensive endpoint testing after each phase
- **Documentation**: Update API docs with each phase

### Success Metrics

- ✅ All endpoints follow consistent `/api/v2/*` pattern
- ✅ Single health endpoint provides comprehensive status
- ✅ No broken or deprecated endpoints exposed
- ✅ Clear separation of production vs development tools
- ✅ Improved API documentation and discoverability
- ✅ Faster frontend development with predictable endpoints

---

## Post-Cleanup Benefits

1. **Developer Experience**

   - Predictable endpoint structure
   - Easier API discovery
   - Better documentation generation
   - Consistent error handling

2. **Maintenance**

   - Reduced code duplication
   - Cleaner router organization
   - Easier to add new features
   - Better testing coverage

3. **Frontend Integration**

   - Single API base URL pattern
   - Consistent request/response formats
   - Better error handling
   - Improved caching strategies

4. **Production Readiness**
   - Clean API surface area
   - Proper health monitoring
   - Development tools separated
   - Better security posture

The cleanup maintains all existing functionality while significantly improving the developer experience and API organization.
