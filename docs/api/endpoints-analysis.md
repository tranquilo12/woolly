# Woolly API Endpoints Analysis & MCP Integration

_Last Updated: December 2024_

## MCP Integration Status

**Current State**: ✅ **MCP servers are now integrated across multiple endpoints** with full chat support.

- **MCP Server URL**: `http://localhost:8009/sse/`
- **Integration Method**: Pydantic AI with `MCPServerStreamableHTTP`
- **Available MCP Tools**: `search_code`, `find_entities`, `get_entity_relationships`, `qa_codebase`, `generate_diagram`
- **Access Pattern**:
  - ✅ **Universal Agent System** (`/api/v1/agents/*`) - Full MCP access
  - ✅ **Triage System** (`/api/v1/triage/*`) - Full MCP access
  - ✅ **Chat System** (`/api/chat/{id}/ai`) - **NEW** MCP-enabled chat endpoint
  - ✅ **MCP Status** (`/api/mcp/status`) - Real-time MCP monitoring

## API Endpoints Catalog

| Endpoint                                          | Method | Purpose                   | MCP Access    | Current Issues     | Uniformity Suggestions          |
| ------------------------------------------------- | ------ | ------------------------- | ------------- | ------------------ | ------------------------------- |
| **HEALTH & SYSTEM**                               |
| `/api/health`                                     | GET    | Basic health check        | ❌            | None               | ✅ Standard format              |
| `/api/v1/agents/health`                           | GET    | Agent system health       | ✅ Via agents | None               | Merge with main health endpoint |
| `/api/v1/agents/mcp/test`                         | GET    | Test MCP connection       | ✅ Direct     | None               | Move to `/api/mcp/test`         |
| `/api/v1/triage/health`                           | GET    | Triage system health      | ✅ Via agents | None               | Consolidate health endpoints    |
| **CHAT MANAGEMENT**                               |
| `/api/chat/create`                                | POST   | Create new chat           | ❌            | None               | Add optional MCP context param  |
| `/api/chats`                                      | GET    | List all chats            | ❌            | None               | ✅ Standard format              |
| `/api/chat/{chat_id}`                             | DELETE | Delete chat               | ❌            | None               | ✅ Standard format              |
| `/api/chat/{chat_id}/title`                       | PATCH  | Update chat title         | ❌            | None               | ✅ Standard format              |
| **CHAT INTERACTION**                              |
| `/api/chat/{chat_id}`                             | POST   | Chat with streaming       | ❌            | OpenAI tools only  | Migrate to `/ai` endpoint       |
| `/api/chat/{chat_id}/ai`                          | POST   | **NEW** MCP-enabled chat  | ✅ Full MCP   | None               | ✅ Modern MCP integration       |
| `/api/chat`                                       | POST   | Legacy chat endpoint      | ❌            | **No MCP access**  | **Deprecate completely**        |
| `/api/chat/{chat_id}/generate-title`              | POST   | AI title generation       | ❌            | Limited context    | Add MCP context analysis        |
| `/api/chat/{chat_id}/generate-summary`            | POST   | AI summary generation     | ❌            | Limited context    | Add MCP-powered insights        |
| `/api/chat/{chat_id}/generate-rolling-summary`    | POST   | Rolling summary           | ❌            | Limited context    | Add MCP context retention       |
| **MESSAGE MANAGEMENT**                            |
| `/api/chat/{chat_id}/messages`                    | GET    | Get chat messages         | ❌            | None               | Add MCP context filtering       |
| `/api/chat/{chat_id}/messages`                    | POST   | Create message            | ❌            | None               | ✅ Standard format              |
| `/api/chat/{chat_id}/messages/{message_id}`       | PATCH  | Edit message              | ❌            | None               | ✅ Standard format              |
| `/api/chat/{chat_id}/messages/{message_id}`       | DELETE | Delete message            | ❌            | None               | ✅ Standard format              |
| `/api/chat/{chat_id}/messages/{message_id}/model` | PATCH  | Update message model      | ❌            | None               | ✅ Standard format              |
| **AGENT MESSAGES**                                |
| `/api/chat/{chat_id}/agent/messages`              | GET    | Get agent messages        | ❌            | None               | Add MCP tool result filtering   |
| `/api/chat/{chat_id}/agent/messages`              | POST   | Create agent message      | ❌            | None               | ✅ Standard format              |
| **AGENT CRUD**                                    |
| `/api/agents`                                     | POST   | Create agent              | ❌            | None               | Add MCP tool preferences        |
| `/api/agents`                                     | GET    | List agents               | ❌            | None               | Add MCP capability info         |
| `/api/agents/{agent_id}`                          | GET    | Get agent details         | ❌            | None               | Add MCP tool usage stats        |
| `/api/agents/{agent_id}`                          | PATCH  | Update agent              | ❌            | None               | Add MCP tool configuration      |
| `/api/agents/{agent_id}`                          | DELETE | Delete agent              | ❌            | None               | ✅ Standard format              |
| **UNIVERSAL AGENT SYSTEM**                        |
| `/api/v1/agents/execute`                          | POST   | Execute multiple agents   | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/agents/execute/streaming`                | POST   | Stream agent execution    | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/agents/execute/single`                   | POST   | Execute single agent      | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/agents/types`                            | GET    | List agent types          | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/session/{session_id}`             | GET    | Get session status        | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/session/{session_id}`             | DELETE | Cancel session            | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/task/{task_id}`                   | GET    | Get task status           | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/task/{task_id}/retry`             | POST   | Retry failed task         | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/errors/statistics`                | GET    | Get error stats           | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/errors/reset`                     | POST   | Reset error stats         | ✅ Via agents | None               | ✅ Standard format              |
| **TRIAGE SYSTEM**                                 |
| `/api/v1/triage/analyze`                          | POST   | Analyze query only        | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/triage/execute`                          | POST   | Execute triage            | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/triage/execute/streaming`                | POST   | Stream triage execution   | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/triage/stats`                            | GET    | Get triage stats          | ✅ Via agents | None               | ✅ Standard format              |
| **MCP FRONTEND INTEGRATION**                      |
| `/app/api/mcp/repositories`                       | GET    | Get MCP repositories      | ✅ Direct     | None               | Move to backend API             |
| `/app/api/mcp/repositories`                       | POST   | Repository actions        | ✅ Direct     | None               | Move to backend API             |
| `/app/api/mcp/list-repositories`                  | POST   | List indexed repos        | ✅ Direct     | Hardcoded response | Implement real MCP call         |
| **MCP CONTROL & STATUS**                          |
| `/api/mcp/status`                                 | GET    | **NEW** MCP server status | ✅ Direct     | None               | ✅ Real-time monitoring         |
| `/api/mcp/register`                               | POST   | Register MCP server       | ✅ Direct     | None               | ✅ Standard format              |
| `/api/mcp/deregister`                             | POST   | Deregister MCP server     | ✅ Direct     | None               | ✅ Standard format              |
| `/api/mcp/test-connection`                        | POST   | Test MCP connection       | ✅ Direct     | None               | ✅ Standard format              |
| **STREAMING & TESTING**                           |
| `/mock`                                           | POST   | Mock streaming demo       | ❌            | No prefix          | Move to `/api/v2/dev/mock`      |
| `/test`                                           | GET    | Streaming format test     | ❌            | No prefix          | Move to `/api/v2/dev/test`      |
| **LEGACY/DEPRECATED**                             |
| `/api/generate/{specialization}`                  | POST   | Legacy agent execution    | ❌            | **Deprecated**     | **Remove completely**           |
| `/api/strategies`                                 | GET    | Documentation strategies  | ❌            | **Broken**         | **Remove completely**           |
| `/api/strategies/{strategy_name}`                 | GET    | Strategy details          | ❌            | **Broken**         | **Remove completely**           |
| `/api/docs_system_prompt.txt`                     | GET    | System prompt file        | ❌            | None               | Move to `/api/system/prompts`   |

## Critical Issues & Recommendations

### ✅ Major Gap RESOLVED: Chat Endpoints Now Have MCP Access

**Solution Implemented**: The MCP chat gap has been addressed with a new endpoint:

- ✅ `POST /api/chat/{chat_id}/ai` - **Full MCP integration with Pydantic AI**
- ✅ Same AI SDK V5 streaming format as existing chat
- ✅ Automatic MCP tool detection and usage
- ✅ Repository context awareness
- ✅ Fallback to OpenAI-only when MCP unavailable

**Headers Provided**:

- `X-MCP-Enabled: true/false`
- `X-MCP-Status: available/unavailable/failed`
- `X-Repository: woolly` (configurable)
- `X-Chat-Type: pydantic-ai`

### 🔧 Uniformity Issues

1. **Inconsistent Versioning**: Mix of `/api/` and `/api/v1/` prefixes
2. **Scattered Health Checks**: 4 different health endpoints
3. **Frontend MCP Routes**: MCP endpoints in Next.js app should be in backend
4. **Legacy Endpoints**: Broken/deprecated endpoints still exposed

### 📋 Recommended Endpoint Restructure

#### Core Chat (MCP-Enabled)

```
POST /api/v2/chat/{chat_id}                    # MCP-enabled streaming chat
POST /api/v2/chat/{chat_id}/tools/{tool_name}  # Direct MCP tool access
GET  /api/v2/chat/{chat_id}/context            # Repository context
```

#### Unified Agent System

```
POST /api/v2/agents/execute                    # Multi-agent execution
POST /api/v2/agents/execute/streaming          # Streaming execution
POST /api/v2/agents/{agent_type}/execute       # Single agent execution
```

#### MCP Integration

```
GET  /api/v2/mcp/tools                         # Available MCP tools
POST /api/v2/mcp/tools/{tool_name}             # Direct tool execution
GET  /api/v2/mcp/repositories                  # Repository management
GET  /api/v2/mcp/health                        # MCP connection status
```

#### System & Health

```
GET  /api/v2/health                            # Unified health check
GET  /api/v2/system/info                       # System information
GET  /api/v2/system/capabilities               # Available features
```

## Current Status & Next Steps

### ✅ **Completed (Since Original Document)**

1. ✅ **MCP Chat Integration** - `/api/chat/{id}/ai` endpoint added
2. ✅ **MCP Status Monitoring** - `/api/mcp/status` with real-time health checks
3. ✅ **Universal Agent System** - Fully functional with MCP integration
4. ✅ **Triage System** - Smart agent routing with MCP tools

### 🔄 **Remaining Implementation Priority**

1. **High Priority**: Standardize API versioning (`/api/v2/*` for all)
2. **Medium Priority**: Consolidate health checks into single endpoint
3. **Low Priority**: Remove deprecated endpoints (`/generate/*`, `/strategies/*`)
4. **Cleanup**: Move streaming test endpoints to organized structure

### 📊 **Current Architecture Health**

- **MCP Integration**: ✅ **Excellent** - Available across all major systems
- **Agent Pipeline**: ✅ **Excellent** - Universal factory + triage routing
- **Streaming Support**: ✅ **Excellent** - AI SDK V5 format everywhere
- **API Organization**: ⚠️ **Needs Polish** - Mixed versioning, scattered endpoints

**The core functionality is solid - remaining work is primarily organizational cleanup for better developer experience.**
