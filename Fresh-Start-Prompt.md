# 🚀 Fresh Start Prompt: Phase 5.3 Frontend-Backend Alignment & Component Cleanup

## 🎯 **CURRENT STATUS & CONTEXT**

You are beginning **Phase 5.3: Frontend-Backend Alignment** of the Backend Simplification Plan for the Woolly project. This is a comprehensive codebase analysis and streaming optimization system built with:

- **Backend**: FastAPI + Pydantic AI + Universal Agent Factory
- **Frontend**: Next.js 15 + React 19 + shadcn/ui + Tailwind CSS
- **Architecture**: 81% code reduction achieved through Universal Agent patterns

### **📋 COMPLETED ACHIEVEMENTS (Phase 5.2: Tasks #19-20)**

✅ **Component Modernization Complete**:

- `components/agent-panel/agent-panel.tsx` - Migrated to shadcn/ui Card layout
- `components/agent-panel/message-group.tsx` - React 19 hooks modernization
- `components/agent-panel/streaming-chat.tsx` - Real-time streaming UI with shadcn/ui
- `components/agent-panel/tool-call-indicator.tsx` - Progress visualization components

✅ **Technical Infrastructure**:

- React 19 performance optimizations (useCallback, useMemo, useTransition)
- shadcn/ui design system integration throughout
- Enhanced accessibility with proper ARIA labels
- TypeScript compilation successful with no production errors

## 🚨 **CRITICAL PROBLEM IDENTIFIED**

**FRONTEND-BACKEND MISALIGNMENT**: The frontend currently displays components like "Database connection" and other MCP server details that don't align with the actual backend endpoints. The frontend needs comprehensive cleanup to show only components connected to our new Universal Agent Factory endpoints.

## 🎯 **YOUR IMMEDIATE MISSION**

**PRIORITY**: Complete **Phase 5.3 Frontend-Backend Alignment** as outlined in `Backend-Simplification-Plan.md` (lines 401-450).

### **📊 CRITICAL NEXT STEPS (In Order)**

#### **TASK #24: Frontend Component Audit & Cleanup** ⚡ URGENT PRIORITY

**Goal**: Remove non-functional components and align frontend with actual backend capabilities
**Files to Audit**:

- `components/agent-panel/` - Remove MCP display components not connected to backend
- `components/repository-*` - Verify repository management components work with actual endpoints
- `components/indexing-*` - Ensure indexing components connect to real MCP server endpoints
- `app/chat/[id]/page.tsx` - Verify chat functionality aligns with Universal Agent Factory

**Acceptance Criteria**:

- All displayed components must have working backend endpoints
- Remove any "Database connection" or mock MCP server status displays
- Maintain only functional streaming chat and agent panel components

#### **TASK #25: Backend Endpoint Verification** ⚡ HIGH PRIORITY

**Goal**: Comprehensive analysis of actual backend endpoints vs frontend expectations
**Analysis Required**:

```bash
# Verify actual backend endpoints
curl -X GET http://localhost:8000/docs  # FastAPI OpenAPI docs
curl -X GET http://localhost:8000/api/v1/agents/  # Universal Agent endpoints
```

**Files to Review**:

- `api/routers/agents.py` - Actual available endpoints
- `api/routers/universal_agents.py` - Universal Agent Factory endpoints
- `lib/api/` - Frontend API client alignment

#### **TASK #26: MCP Server Integration Cleanup** 🔌 HIGH PRIORITY

**Goal**: Ensure MCP server integration works properly with frontend components
**Current Issue**: Frontend shows MCP server details but may not be connected to actual MCP functionality

**Files to Check**:

- `components/indexing-status-panel.tsx` - Should connect to real MCP indexing
- `components/repository-list.tsx` - Should show actual indexed repositories
- `hooks/use-repository-status.ts` - Should fetch real repository data

#### **TASK #27: Vercel AI SDK Integration** 🎨 MEDIUM PRIORITY

**Goal**: Complete end-to-end streaming integration
**Pattern Implementation**:

```tsx
// app/chat/[id]/page.tsx
import { useChat } from "ai/react";

const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat(
  {
    api: "/api/v1/agents/universal/stream",
    streamMode: "text",
  }
);
```

### **🏗️ ARCHITECTURE ALIGNMENT REQUIREMENTS**

#### **1. Verify Universal Agent Factory Endpoints**

**Current Backend Structure** (from `api/agents/universal.py`):

```python
class UniversalAgentFactory:
    def create_agent(self, agent_type: AgentType) -> Agent:
        return Agent(
            model="openai:gpt-4o-mini",
            deps_type=UniversalDependencies,
            result_type=UniversalResult,
            system_prompt=self.specializations[agent_type],
            mcp_servers=[self.mcp_server]  # MCP integration
        )
```

**Frontend Must Align With**:

- Only show agent types that exist in backend
- Only display MCP server status if actually connected
- Remove any mock or placeholder components

#### **2. MCP Server Reality Check**

**Current MCP Integration** [[memory:2924205]]:

- Must use provided MCP client via cursor MCP tools
- No direct HTTP calls or curl to MCP server
- Frontend should reflect actual MCP server capabilities

**Frontend Components to Verify**:

```
components/indexing-status-panel.tsx - Real MCP indexing status?
components/repository-list.tsx - Real repository data?
components/static-repository-stats.tsx - Real stats or mock?
```

#### **3. Component Hierarchy Cleanup**

**CURRENT (potentially misaligned)**:

```
app/chat/[id]/page.tsx
├── AgentPanel ✅ (modernized)
│   ├── StreamingChat ✅ (working)
│   ├── ToolCallIndicator ✅ (working)
│   ├── MessageGroup ✅ (modernized)
│   └── ??? (MCP status displays - need verification)
├── RepositoryList ??? (connected to real data?)
├── IndexingStatusPanel ??? (real MCP indexing?)
└── DatabaseConnection ??? (should this exist?)
```

**TARGET (aligned)**:

```
app/chat/[id]/page.tsx
├── AgentPanel ✅ (verified working)
│   ├── StreamingChat ✅ (connected to Universal Agent)
│   ├── ToolCallIndicator ✅ (real progress)
│   └── MessageGroup ✅ (real message data)
├── RepositorySection (only if MCP server connected)
└── IndexingStatus (only if real indexing active)
```

## 🔧 **EXECUTION STRATEGY**

### **Phase 1: Discovery & Analysis (30 minutes)**

1. **Backend Endpoint Discovery**:

   ```bash
   # Start backend and analyze actual endpoints
   cd /Users/shriramsunder/Projects/Parational/woolly
   python -m uvicorn main:app --reload --port 8000
   curl -X GET http://localhost:8000/docs | jq '.'
   ```

2. **MCP Server Status Verification**:

   - Use cursor MCP tools to check actual MCP server connection
   - Verify which repositories are actually indexed
   - Check if MCP server is responding to queries

3. **Frontend Component Audit**:
   - List all components in `components/` directory
   - Identify which components display backend data
   - Mark components as "working", "broken", or "mock"

### **Phase 2: Cleanup & Alignment (45 minutes)**

1. **Remove Non-Functional Components**:

   - Delete or disable components that don't connect to real backend
   - Remove mock MCP server status displays
   - Clean up repository components if MCP server not connected

2. **Fix Broken Integrations**:

   - Update API calls to match actual backend endpoints
   - Fix repository listing if MCP server is working
   - Ensure indexing status reflects real indexing state

3. **Vercel AI SDK Integration**:
   - Wire `useChat` hook to Universal Agent Factory endpoints
   - Test end-to-end streaming functionality
   - Implement proper error handling for disconnected services

### **Phase 3: Testing & Validation (15 minutes)**

1. **Functional Testing**:

   - Verify all displayed components work with real backend
   - Test streaming chat with Universal Agent Factory
   - Validate MCP server integration (if connected)

2. **Performance Testing**:
   - Run Lighthouse audit on cleaned-up frontend
   - Verify no broken API calls or 404 errors
   - Test responsive design with actual data

## 📋 **TODO LIST FOR IMMEDIATE EXECUTION**

Create these specific todos using the `todo_write` tool:

```json
[
  {
    "id": "task-24",
    "content": "Frontend component audit: Remove non-functional MCP display components",
    "status": "pending",
    "dependencies": []
  },
  {
    "id": "task-25",
    "content": "Backend endpoint verification: Analyze actual vs expected API endpoints",
    "status": "pending",
    "dependencies": []
  },
  {
    "id": "task-26",
    "content": "MCP server integration cleanup: Verify real MCP functionality",
    "status": "pending",
    "dependencies": ["task-24"]
  },
  {
    "id": "task-27",
    "content": "Complete Vercel AI SDK integration with Universal Agent Factory",
    "status": "pending",
    "dependencies": ["task-25", "task-26"]
  },
  {
    "id": "task-28",
    "content": "End-to-end testing: Verify all components work with real backend",
    "status": "pending",
    "dependencies": ["task-24", "task-25", "task-26", "task-27"]
  }
]
```

## 🚨 **CRITICAL ANALYSIS REQUIRED**

### **1. MCP Server Reality Check**

**QUESTION**: Is the MCP server actually running and indexed?
**INVESTIGATION**:

- Use `mcp_shriram-prod-108_repo_list_indexed` to check indexed repositories
- Use `mcp_shriram-prod-108_health_check` to verify MCP server health
- Check if repository indexing is actually working

### **2. Backend Endpoint Alignment**

**QUESTION**: Do frontend API calls match actual backend endpoints?
**INVESTIGATION**:

- Compare `lib/api/` client code with actual FastAPI routes
- Verify Universal Agent Factory endpoints are exposed
- Check if streaming endpoints are properly configured

### **3. Component Functionality Audit**

**QUESTION**: Which components display real data vs mock data?
**INVESTIGATION**:

- `components/repository-list.tsx` - Real repository data?
- `components/indexing-status-panel.tsx` - Real indexing status?
- `components/static-repository-stats.tsx` - Real stats or placeholder?

## 🎯 **SUCCESS CRITERIA FOR THIS SESSION**

### **Minimum Viable Progress**:

1. **Complete component audit** - Know which components work vs broken
2. **Backend endpoint verification** - Understand actual API surface
3. **MCP server status confirmed** - Know if MCP integration is working
4. **Remove non-functional components** - Clean frontend of broken parts

### **Stretch Goals**:

1. **Vercel AI SDK integration complete** - End-to-end streaming working
2. **All components functional** - No broken or mock components displayed
3. **Performance optimized** - Fast, responsive UI with real data

## 🔍 **DIAGNOSTIC COMMANDS TO RUN FIRST**

```bash
# 1. Check if backend is running
curl -I http://localhost:8000/health || echo "Backend not running"

# 2. List actual API endpoints
curl -s http://localhost:8000/docs | grep -i "path"

# 3. Test MCP server connection
# Use cursor MCP tools: mcp_shriram-prod-108_health_check

# 4. Check frontend build status
pnpm run build --dry-run

# 5. Verify repository indexing
# Use cursor MCP tools: mcp_shriram-prod-108_repo_list_indexed
```

## 📚 **KEY FILES TO REFERENCE**

### **Backend Reality**:

- `Backend-Simplification-Plan.md` (lines 401-450) - Phase 5.3 requirements
- `api/agents/universal.py` - Universal Agent Factory implementation
- `api/routers/agents.py` - Actual API endpoints
- `main.py` - FastAPI app configuration

### **Frontend Components to Audit**:

- `components/agent-panel/` - Core agent components (✅ working)
- `components/repository-*` - Repository management (❓ needs verification)
- `components/indexing-*` - Indexing status (❓ needs verification)
- `app/chat/[id]/page.tsx` - Main chat interface (❓ needs backend alignment)

### **Integration Points**:

- `lib/api/` - Frontend API client
- `hooks/use-repository-status.ts` - Repository data fetching
- `types/` - TypeScript type definitions

---

## 🚨 **CRITICAL REMINDERS**

1. **MCP Server Integration** - Must use cursor MCP tools, not direct HTTP [[memory:2924205]]
2. **Simplicity Priority** - Remove broken components rather than fix complex issues
3. **Backend-First Approach** - Frontend should reflect actual backend capabilities
4. **No Mock Data** - All displayed information must be real and functional
5. **Performance Focus** - Clean, fast UI with working components only

**START HERE**: Begin with Task #24 (component audit) using the MCP tools to understand what's actually working, then systematically align the frontend with backend reality.

**Remember**: The goal is a clean, functional frontend that accurately reflects the powerful Universal Agent Factory backend we've built. Remove anything that doesn't work - simplicity over complexity.
