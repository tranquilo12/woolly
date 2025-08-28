# Woolly API Endpoints Analysis & MCP Integration

## MCP Integration Status

**Current State**: MCP servers are integrated at the **agent level only**. Chat endpoints do NOT have direct MCP access.

- **MCP Server URL**: `http://localhost:8009/sse/`
- **Integration Method**: Pydantic AI with `MCPServerStreamableHTTP`
- **Available MCP Tools**: `search_code`, `find_entities`, `get_entity_relationships`, `qa_codebase`, `generate_diagram`
- **Access Pattern**: MCP tools are only accessible through Universal Agent System (`/api/v1/agents/*`)

## API Endpoints Catalog

| Endpoint                                          | Method | Purpose                  | MCP Access    | Current Issues     | Uniformity Suggestions          |
| ------------------------------------------------- | ------ | ------------------------ | ------------- | ------------------ | ------------------------------- |
| **HEALTH & SYSTEM**                               |
| `/api/health`                                     | GET    | Basic health check       | ❌            | None               | ✅ Standard format              |
| `/api/v1/agents/health`                           | GET    | Agent system health      | ✅ Via agents | None               | Merge with main health endpoint |
| `/api/v1/agents/mcp/test`                         | GET    | Test MCP connection      | ✅ Direct     | None               | Move to `/api/mcp/test`         |
| `/api/v1/triage/health`                           | GET    | Triage system health     | ✅ Via agents | None               | Consolidate health endpoints    |
| **CHAT MANAGEMENT**                               |
| `/api/chat/create`                                | POST   | Create new chat          | ❌            | None               | Add optional MCP context param  |
| `/api/chats`                                      | GET    | List all chats           | ❌            | None               | ✅ Standard format              |
| `/api/chat/{chat_id}`                             | DELETE | Delete chat              | ❌            | None               | ✅ Standard format              |
| `/api/chat/{chat_id}/title`                       | PATCH  | Update chat title        | ❌            | None               | ✅ Standard format              |
| **CHAT INTERACTION**                              |
| `/api/chat/{chat_id}`                             | POST   | Chat with streaming      | ❌            | **No MCP access**  | **Add MCP tool integration**    |
| `/api/chat`                                       | POST   | Legacy chat endpoint     | ❌            | **No MCP access**  | **Deprecate or add MCP**        |
| `/api/chat/{chat_id}/generate-title`              | POST   | AI title generation      | ❌            | Limited context    | Add MCP context analysis        |
| `/api/chat/{chat_id}/generate-summary`            | POST   | AI summary generation    | ❌            | Limited context    | Add MCP-powered insights        |
| `/api/chat/{chat_id}/generate-rolling-summary`    | POST   | Rolling summary          | ❌            | Limited context    | Add MCP context retention       |
| **MESSAGE MANAGEMENT**                            |
| `/api/chat/{chat_id}/messages`                    | GET    | Get chat messages        | ❌            | None               | Add MCP context filtering       |
| `/api/chat/{chat_id}/messages`                    | POST   | Create message           | ❌            | None               | ✅ Standard format              |
| `/api/chat/{chat_id}/messages/{message_id}`       | PATCH  | Edit message             | ❌            | None               | ✅ Standard format              |
| `/api/chat/{chat_id}/messages/{message_id}`       | DELETE | Delete message           | ❌            | None               | ✅ Standard format              |
| `/api/chat/{chat_id}/messages/{message_id}/model` | PATCH  | Update message model     | ❌            | None               | ✅ Standard format              |
| **AGENT MESSAGES**                                |
| `/api/chat/{chat_id}/agent/messages`              | GET    | Get agent messages       | ❌            | None               | Add MCP tool result filtering   |
| `/api/chat/{chat_id}/agent/messages`              | POST   | Create agent message     | ❌            | None               | ✅ Standard format              |
| **AGENT CRUD**                                    |
| `/api/agents`                                     | POST   | Create agent             | ❌            | None               | Add MCP tool preferences        |
| `/api/agents`                                     | GET    | List agents              | ❌            | None               | Add MCP capability info         |
| `/api/agents/{agent_id}`                          | GET    | Get agent details        | ❌            | None               | Add MCP tool usage stats        |
| `/api/agents/{agent_id}`                          | PATCH  | Update agent             | ❌            | None               | Add MCP tool configuration      |
| `/api/agents/{agent_id}`                          | DELETE | Delete agent             | ❌            | None               | ✅ Standard format              |
| **UNIVERSAL AGENT SYSTEM**                        |
| `/api/v1/agents/execute`                          | POST   | Execute multiple agents  | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/agents/execute/streaming`                | POST   | Stream agent execution   | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/agents/execute/single`                   | POST   | Execute single agent     | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/agents/types`                            | GET    | List agent types         | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/session/{session_id}`             | GET    | Get session status       | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/session/{session_id}`             | DELETE | Cancel session           | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/task/{task_id}`                   | GET    | Get task status          | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/task/{task_id}/retry`             | POST   | Retry failed task        | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/errors/statistics`                | GET    | Get error stats          | ✅ Via agents | None               | ✅ Standard format              |
| `/api/v1/agents/errors/reset`                     | POST   | Reset error stats        | ✅ Via agents | None               | ✅ Standard format              |
| **TRIAGE SYSTEM**                                 |
| `/api/v1/triage/analyze`                          | POST   | Analyze query only       | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/triage/execute`                          | POST   | Execute triage           | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/triage/execute/streaming`                | POST   | Stream triage execution  | ✅ Full MCP   | None               | ✅ Modern design                |
| `/api/v1/triage/stats`                            | GET    | Get triage stats         | ✅ Via agents | None               | ✅ Standard format              |
| **MCP FRONTEND INTEGRATION**                      |
| `/app/api/mcp/repositories`                       | GET    | Get MCP repositories     | ✅ Direct     | None               | Move to backend API             |
| `/app/api/mcp/repositories`                       | POST   | Repository actions       | ✅ Direct     | None               | Move to backend API             |
| `/app/api/mcp/list-repositories`                  | POST   | List indexed repos       | ✅ Direct     | Hardcoded response | Implement real MCP call         |
| **STREAMING & TESTING**                           |
| `/api/streaming/mock`                             | POST   | Mock streaming demo      | ❌            | None               | Add MCP tool simulation         |
| `/api/streaming/test`                             | GET    | Streaming format test    | ❌            | None               | ✅ Standard format              |
| **LEGACY/DEPRECATED**                             |
| `/api/generate/{specialization}`                  | POST   | Legacy agent execution   | ❌            | **Deprecated**     | **Remove completely**           |
| `/api/strategies`                                 | GET    | Documentation strategies | ❌            | **Broken**         | **Remove completely**           |
| `/api/strategies/{strategy_name}`                 | GET    | Strategy details         | ❌            | **Broken**         | **Remove completely**           |
| `/api/docs_system_prompt.txt`                     | GET    | System prompt file       | ❌            | None               | Move to `/api/system/prompts`   |

## Critical Issues & Recommendations

### 🚨 Major Gap: Chat Endpoints Lack MCP Access

**Problem**: Core chat endpoints (`/api/chat/{chat_id}`) cannot access MCP tools, limiting their capability for code-aware conversations.

**Impact**:

- Chat conversations cannot search code
- No repository context in responses
- Limited to basic OpenAI tools only

**Solution**: Create MCP-enabled chat endpoints:

```
POST /api/v2/chat/{chat_id}          # MCP-enabled chat
POST /api/v2/chat/{chat_id}/mcp      # Explicit MCP tool access
GET  /api/v2/chat/{chat_id}/context  # Repository context
```

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

## Implementation Priority

1. **High Priority**: Add MCP access to chat endpoints
2. **Medium Priority**: Consolidate health checks and versioning
3. **Low Priority**: Remove deprecated endpoints
4. **Cleanup**: Move frontend MCP routes to backend

This restructure would provide uniform MCP access across all endpoints while maintaining backward compatibility through versioning.
