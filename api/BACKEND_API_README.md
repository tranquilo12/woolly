# Woolly Backend API

A FastAPI-based backend for AI-powered code analysis and documentation generation with real-time streaming support.

## Quick Start

### Prerequisites

- Python 3.8+
- PostgreSQL database
- OpenAI API key

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost/woolly
OPENAI_API_KEY=your-openai-api-key
MCP_SERVER_URL=http://localhost:8009/sse/  # Optional - enables MCP features
```

### Running the API

```bash
# Install dependencies
pip install -r api/requirements.txt

# Run database migrations
alembic upgrade head

# Start the server
uvicorn api.index:app --host 0.0.0.0 --port 8000 --reload
```

## 📋 Complete API Endpoints Reference

### Frontend Integration Guide

This table provides a complete overview of all available endpoints with request/response formats optimized for frontend consumption.

**Legend:**

- 🟢 **Fully Working** - Production ready
- 🟡 **Partial/Conditional** - Works with dependencies
- 🔴 **Deprecated/Broken** - Avoid using
- 🆕 **New Feature** - Recently added

| Endpoint                                          | Method | Purpose                      | Status | Request Format                                                                                     | Response Format                                                                                                 | MCP Access | Notes                                      |
| ------------------------------------------------- | ------ | ---------------------------- | ------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------ |
| **HEALTH & SYSTEM**                               |
| `/api/health`                                     | GET    | Basic health check           | 🟢     | None                                                                                               | `{"status": "healthy"}`                                                                                         | ❌         | Always use for basic health                |
| `/api/agents/health`                              | GET    | Agent system health          | 🟢     | None                                                                                               | `{"status": "healthy", "system": "...", "endpoints": {...}}`                                                    | ✅         | Detailed system status                     |
| `/api/v1/agents/health`                           | GET    | Universal agent health       | 🟡     | None                                                                                               | `{"status": "healthy", "factory": {...}, "parallel_manager": {...}}`                                            | ✅         | Requires MCP for full status               |
| `/api/v1/triage/health`                           | GET    | Triage system health         | 🟡     | None                                                                                               | `{"status": "healthy", "triage_agent": "...", "mcp_server": "..."}`                                             | ✅         | Depends on agent system                    |
| `/api/mcp/status`                                 | GET    | **🆕 MCP server status**     | 🟢     | None                                                                                               | `{"status": "healthy\|degraded\|failed", "available": bool, "capabilities": [...]}`                             | ✅         | **Frontend should use this**               |
| **CHAT MANAGEMENT**                               |
| `/api/chat/create`                                | POST   | Create new chat              | 🟢     | `{"agent_id": "uuid"}` (optional)                                                                  | `{"id": "uuid"}`                                                                                                | ❌         | Returns chat UUID                          |
| `/api/chats`                                      | GET    | List all chats               | 🟢     | None                                                                                               | `[{"id": "uuid", "title": "...", "created_at": "...", "updated_at": "..."}]`                                    | ❌         | Ordered by last updated                    |
| `/api/chat/{chat_id}`                             | DELETE | Delete chat                  | 🟢     | None                                                                                               | `{"success": true}`                                                                                             | ❌         | Cascades to messages                       |
| `/api/chat/{chat_id}/title`                       | PATCH  | Update chat title            | 🟢     | `{"title": "New Title"}`                                                                           | `{"success": true, "title": "..."}`                                                                             | ❌         | Manual title update                        |
| **CHAT INTERACTION**                              |
| `/api/chat/{chat_id}`                             | POST   | **Standard chat streaming**  | 🟢     | `{"messages": [...], "model": "gpt-4o"}`                                                           | AI SDK V5 streaming                                                                                             | ❌         | Standard OpenAI streaming                  |
| `/api/chat/{chat_id}/ai`                          | POST   | **🆕 MCP-enabled chat**      | 🟢     | Same as above + `?repository_name=woolly`                                                          | AI SDK V5 + MCP headers                                                                                         | ✅         | **Use for code-aware chat**                |
| `/api/chat`                                       | POST   | Legacy chat endpoint         | 🟢     | Same as standard chat                                                                              | AI SDK V5 streaming                                                                                             | ❌         | Backward compatibility                     |
| **CHAT UTILITIES (AI-POWERED)**                   |
| `/api/chat/{chat_id}/generate-title`              | POST   | AI title generation          | 🟢     | `{"chat_id": "uuid", "model": "gpt-4o-mini"}`                                                      | `{"title": "...", "usage": {...}}`                                                                              | ❌         | Auto-updates chat title                    |
| `/api/chat/{chat_id}/generate-summary`            | POST   | Full conversation summary    | 🟢     | `{"chat_id": "uuid", "model": "gpt-4o-mini"}`                                                      | `{"summary": "...", "usage": {...}}`                                                                            | ❌         | Summarizes all messages                    |
| `/api/chat/{chat_id}/generate-rolling-summary`    | POST   | Rolling summary              | 🟢     | `{"chat_id": "uuid", "skip_interactions": 2, "model": "gpt-4o-mini"}`                              | `{"summary": "...", "usage": {...}}`                                                                            | ❌         | Skips first N interactions                 |
| **MESSAGE MANAGEMENT**                            |
| `/api/chat/{chat_id}/messages`                    | GET    | Get chat messages            | 🟢     | None                                                                                               | `[{"id": "uuid", "role": "user\|assistant", "content": "...", "created_at": "...", "tool_invocations": [...]}]` | ❌         | Excludes agent messages                    |
| `/api/chat/{chat_id}/messages`                    | POST   | Create message               | 🟢     | `{"role": "user\|assistant", "content": "...", "toolInvocations": [...]}`                          | `{"id": "uuid", "created_at": "..."}`                                                                           | ❌         | Manual message creation                    |
| `/api/chat/{chat_id}/messages/{message_id}`       | PATCH  | Edit message                 | 🟢     | `{"content": "Updated content"}`                                                                   | `{"success": true}`                                                                                             | ❌         | Removes subsequent messages                |
| `/api/chat/{chat_id}/messages/{message_id}`       | DELETE | Delete message               | 🟢     | None                                                                                               | `{"success": true}`                                                                                             | ❌         | Single message deletion                    |
| `/api/chat/{chat_id}/messages/{message_id}/model` | PATCH  | Update message model         | 🟢     | `{"model": "gpt-4o"}`                                                                              | `{"success": true}`                                                                                             | ❌         | Change AI model used                       |
| **AGENT MESSAGES**                                |
| `/api/chat/{chat_id}/agent/messages`              | GET    | Get agent messages           | 🟢     | Query: `?agent_id=uuid&repository=name&message_type=type`                                          | `[{"id": "uuid", "agent_id": "...", "repository": "...", "content": "..."}]`                                    | ❌         | Separate from chat messages                |
| `/api/chat/{chat_id}/agent/messages`              | POST   | Create agent message         | 🟢     | `{"agent_id": "uuid", "repository": "...", "content": "...", "message_type": "agent_result"}`      | `{"id": "uuid", "created_at": "..."}`                                                                           | ❌         | For agent system results                   |
| **AGENT CRUD**                                    |
| `/api/agents`                                     | POST   | Create agent                 | 🟢     | `{"name": "...", "description": "...", "system_prompt": "...", "tools": [...]}`                    | `{"id": "uuid", "name": "...", "created_at": "...", "is_active": true}`                                         | ❌         | Custom agent creation                      |
| `/api/agents`                                     | GET    | List agents                  | 🟢     | Query: `?repository=name&type=agent_type`                                                          | `[{"id": "uuid", "name": "...", "description": "...", "tools": [...]}]`                                         | ❌         | Filter by repo/type                        |
| `/api/agents/{agent_id}`                          | GET    | Get agent details            | 🟢     | None                                                                                               | `{"id": "uuid", "name": "...", "system_prompt": "...", "tools": [...]}`                                         | ❌         | Single agent info                          |
| `/api/agents/{agent_id}`                          | PATCH  | Update agent                 | 🟢     | `{"name": "...", "description": "...", "is_active": bool}`                                         | `{"id": "uuid", "updated_at": "..."}`                                                                           | ❌         | Partial updates allowed                    |
| `/api/agents/{agent_id}`                          | DELETE | Delete agent                 | 🟢     | None                                                                                               | `{"success": true}`                                                                                             | ❌         | Permanent deletion                         |
| **UNIVERSAL AGENT SYSTEM**                        |
| `/api/v1/agents/execute`                          | POST   | Execute multiple agents      | 🟡     | `{"repository_name": "...", "user_query": "...", "agent_types": [...], "run_in_background": bool}` | `{"status": "completed\|started", "results": {...}, "session_id": "uuid"}`                                      | ✅         | **Requires MCP server**                    |
| `/api/v1/agents/execute/streaming`                | POST   | Stream agent execution       | 🟡     | Same as above                                                                                      | Streaming agent results                                                                                         | ✅         | Real-time agent output                     |
| `/api/v1/agents/execute/single`                   | POST   | Execute single agent         | 🟡     | `{"repository_name": "...", "user_query": "...", "agent_type": "...", "enable_streaming": bool}`   | `{"status": "completed", "result": "...", "metadata": {...}}`                                                   | ✅         | Single agent execution                     |
| `/api/v1/agents/types`                            | GET    | List agent types             | 🟢     | None                                                                                               | `{"agent_types": [...], "descriptions": {...}, "total_count": 5}`                                               | ✅         | Available agent types                      |
| `/api/v1/agents/session/{session_id}`             | GET    | Get session status           | 🟡     | None                                                                                               | `{"status": "running\|completed", "progress": 0.75, "completed_agents": [...]}`                                 | ✅         | Background session tracking                |
| `/api/v1/agents/session/{session_id}`             | DELETE | Cancel session               | 🟡     | None                                                                                               | `{"success": true}`                                                                                             | ✅         | Stop background execution                  |
| `/api/v1/agents/task/{task_id}`                   | GET    | Get task status              | 🟡     | None                                                                                               | `{"status": "...", "result": "...", "error": "..."}`                                                            | ✅         | Individual task tracking                   |
| `/api/v1/agents/task/{task_id}/retry`             | POST   | Retry failed task            | 🟡     | None                                                                                               | `{"status": "retrying", "task_id": "..."}`                                                                      | ✅         | Retry failed operations                    |
| `/api/v1/agents/errors/statistics`                | GET    | Get error stats              | 🟡     | None                                                                                               | `{"total_errors": 0, "error_types": {...}}`                                                                     | ✅         | System monitoring                          |
| `/api/v1/agents/errors/reset`                     | POST   | Reset error stats            | 🟡     | None                                                                                               | `{"success": true}`                                                                                             | ✅         | Clear error counters                       |
| **TRIAGE SYSTEM**                                 |
| `/api/v1/triage/analyze`                          | POST   | Analyze query only           | 🟡     | `{"repository_name": "...", "user_query": "...", "user_context": {...}}`                           | `{"triage_decision": "...", "reasoning": "...", "recommended_agents": [...]}`                                   | ✅         | Query analysis without execution           |
| `/api/v1/triage/execute`                          | POST   | Execute triage               | 🟡     | Same as analyze + `{"chat_id": "uuid"}`                                                            | `{"triage_decision": "...", "result": "...", "execution_time": 5.2}`                                            | ✅         | Smart agent routing                        |
| `/api/v1/triage/execute/streaming`                | POST   | Stream triage execution      | 🟡     | Same as execute                                                                                    | Streaming triage results                                                                                        | ✅         | Real-time triage + execution               |
| `/api/v1/triage/stats`                            | GET    | Get triage stats             | 🟡     | None                                                                                               | `{"total_queries": 0, "decision_breakdown": {...}}`                                                             | ✅         | Triage system metrics                      |
| **MCP CONTROL (🆕 HOT-SWAP)**                     |
| `/api/mcp/register`                               | POST   | **🆕 Register MCP server**   | 🟢     | `{"url": "http://localhost:8009/sse/", "validate_connection": true}`                               | `{"success": true, "message": "...", "server_info": {...}}`                                                     | ✅         | **Dynamic MCP registration**               |
| `/api/mcp/deregister`                             | POST   | **🆕 Deregister MCP server** | 🟢     | None                                                                                               | `{"success": true, "message": "MCP server deregistered"}`                                                       | ✅         | Remove active MCP server                   |
| `/api/mcp/registry/status`                        | GET    | **🆕 Registry status**       | 🟢     | None                                                                                               | `{"active_server": "url", "is_active": bool, "registry_info": {...}}`                                           | ✅         | Check current MCP registration             |
| `/api/mcp/test-connection`                        | POST   | **🆕 Test MCP connection**   | 🟢     | None                                                                                               | `{"connection_test": "success\|failed", "details": {...}}`                                                      | ✅         | Test current MCP server                    |
| **TESTING & DIAGNOSTICS**                         |
| `/api/v1/agents/mcp/test`                         | GET    | Legacy MCP test              | 🟡     | None                                                                                               | `{"status": "completed", "test_result": {...}}`                                                                 | ✅         | **Use `/api/mcp/test-connection` instead** |
| `/api/streaming/mock`                             | POST   | Mock streaming demo          | 🟢     | `{"prompt": "test message"}`                                                                       | AI SDK V5 streaming with mock tools                                                                             | ❌         | Test streaming format                      |
| `/api/streaming/test`                             | GET    | Streaming format test        | 🟢     | None                                                                                               | HTML page with examples                                                                                         | ❌         | Development reference                      |
| **DEPRECATED/LEGACY**                             |
| `/api/generate/{specialization}`                  | POST   | Legacy agent execution       | 🔴     | Various                                                                                            | Various                                                                                                         | ❌         | **DEPRECATED - Use universal system**      |
| `/api/strategies`                                 | GET    | Documentation strategies     | 🔴     | None                                                                                               | Error                                                                                                           | ❌         | **BROKEN - Remove**                        |
| `/api/strategies/{strategy_name}`                 | GET    | Strategy details             | 🔴     | None                                                                                               | Error                                                                                                           | ❌         | **BROKEN - Remove**                        |
| `/api/docs_system_prompt.txt`                     | GET    | System prompt file           | 🟢     | None                                                                                               | Text file                                                                                                       | ❌         | **Move to `/api/system/prompts`**          |

### 🎯 Frontend Integration Recommendations

#### **For Standard Chat Applications:**

```javascript
// Use standard chat endpoint
POST / api / chat / { chatId };
// Headers: Content-Type: application/json
// Body: { messages: [...], model: "gpt-4o" }
```

#### **For Code-Aware Chat Applications:**

```javascript
// Use MCP-enabled chat endpoint
POST /api/chat/{chatId}/ai?repository_name=woolly
// Headers: Content-Type: application/json
// Body: { messages: [...], model: "gpt-4o" }
// Response Headers: X-MCP-Enabled, X-MCP-Status, X-MCP-Capabilities
```

#### **For MCP Status Monitoring:**

```javascript
// Check MCP availability before showing code features
const mcpStatus = await fetch("/api/mcp/status").then((r) => r.json());
if (mcpStatus.available) {
  // Show code analysis features
  enableCodeAnalysisUI(mcpStatus.capabilities);
} else {
  // Show fallback mode
  showFallbackMessage();
}
```

#### **For Dynamic MCP Management:**

```javascript
// Register new MCP server
await fetch("/api/mcp/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: "http://localhost:8009/sse/",
    validate_connection: true,
  }),
});

// Check registration status
const registry = await fetch("/api/mcp/registry/status").then((r) => r.json());
```

## 🚀 Key Features for Frontend Developers

### **AI SDK V5 Streaming Compatibility**

Both chat endpoints (`/api/chat/{chat_id}` and `/api/chat/{chat_id}/ai`) produce identical AI SDK V5 streaming formats:

```
1:{"id": "msg-uuid", "role": "assistant", "parts": []}     # Message start
0:{"type": "text", "text": "Response chunk..."}           # Text content
9:{"type": "tool-call", "toolCallId": "...", ...}          # Tool calls
a:{"type": "tool-result", "toolCallId": "...", ...}        # Tool results
2:{"id": "msg-uuid", "role": "assistant", "parts": [...]}  # Message end
e:{"finishReason": "stop", "usage": {...}}                 # Stream end
```

### **MCP Integration Headers**

The `/api/chat/{chat_id}/ai` endpoint provides additional headers for frontend MCP awareness:

```http
X-Chat-Type: pydantic-ai
X-MCP-Enabled: true|false
X-MCP-Status: healthy|degraded|failed|disabled
X-MCP-Fallback: true|false
X-MCP-Capabilities: search_code,find_entities,qa_codebase,generate_diagram
X-Repository: woolly
```

### **Dynamic MCP Management**

Frontend can dynamically manage MCP servers without backend restarts:

```javascript
// Hot-swap MCP server
await fetch("/api/mcp/register", {
  method: "POST",
  body: JSON.stringify({ url: "http://new-server:8009/sse/" }),
});

// Monitor status changes
const status = await fetch("/api/mcp/status").then((r) => r.json());
// status.available, status.capabilities, status.fallback_mode
```

### **Graceful Degradation**

All MCP-enabled endpoints work seamlessly with or without MCP servers:

- ✅ **MCP Available**: Full code analysis capabilities
- ✅ **MCP Unavailable**: Graceful fallback to standard AI responses
- ✅ **Status Transparency**: Headers and `/api/mcp/status` inform frontend of current state

---

## 📖 Essential Endpoint Details

### 🎯 **Primary Chat Endpoints**

#### **Standard Chat Streaming**

```http
POST /api/chat/{chat_id}
Content-Type: application/json

{
  "messages": [
    {
      "role": "user|assistant",
      "content": "Message content",
      "id": "optional-message-id",
      "toolInvocations": [],
      "experimental_attachments": [
        {
          "contentType": "image/jpeg",
          "url": "data:image/jpeg;base64,..."
        }
      ]
    }
  ],
  "model": "gpt-4o",
  "agent_id": "optional-agent-uuid"
}
```

**Response:** AI SDK V5 streaming format

#### **🆕 MCP-Enabled Chat Streaming**

```http
POST /api/chat/{chat_id}/ai?repository_name=woolly
Content-Type: application/json

# Same request body as standard chat
```

**Response:** AI SDK V5 streaming + MCP headers

- `X-Chat-Type: pydantic-ai`
- `X-MCP-Enabled: true|false`
- `X-MCP-Status: healthy|degraded|failed|disabled`
- `X-MCP-Capabilities: search_code,find_entities,qa_codebase,generate_diagram`

### 🔧 **MCP Management Endpoints**

#### **Check MCP Status**

```http
GET /api/mcp/status

Response:
{
  "status": "healthy|degraded|failed|disabled|unknown|connecting|retrying",
  "available": true,
  "capabilities": ["search_code", "find_entities", "qa_codebase", "generate_diagram"],
  "server_info": {
    "url": "http://localhost:8009/sse/",
    "version": "2.9",
    "response_time_ms": 150.5,
    "last_check": "2024-01-01T00:00:00Z"
  },
  "fallback_mode": false,
  "error_details": {
    "message": "Connection timeout",
    "error_count": 3,
    "consecutive_failures": 2
  }
}
```

#### **🆕 Register MCP Server (Hot-Swap)**

```http
POST /api/mcp/register
Content-Type: application/json

{
  "url": "http://localhost:8009/sse/",
  "validate_connection": true
}

Response:
{
  "success": true,
  "message": "MCP server registered successfully",
  "server_info": {
    "url": "http://localhost:8009/sse/",
    "capabilities": ["search_code", "find_entities"]
  }
}
```

#### **🆕 Deregister MCP Server**

```http
POST /api/mcp/deregister

Response:
{
  "success": true,
  "message": "MCP server deregistered successfully"
}
```

### 🤖 **Chat Utilities (AI-Powered)**

#### **Generate Chat Title**

```http
POST /api/chat/{chat_id}/generate-title
Content-Type: application/json

{
  "chat_id": "uuid-string",
  "model": "gpt-4o-mini"
}

Response:
{
  "chat_id": "uuid-string",
  "title": "Authentication System",
  "model": "gpt-4o-mini",
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 3,
    "total_tokens": 28
  }
}
```

#### **Generate Full Summary**

```http
POST /api/chat/{chat_id}/generate-summary
Content-Type: application/json

{
  "chat_id": "uuid-string",
  "model": "gpt-4o-mini"
}

Response:
{
  "summary": "The conversation covered authentication implementation...",
  "usage": {...}
}
```

#### **Generate Rolling Summary**

```http
POST /api/chat/{chat_id}/generate-rolling-summary
Content-Type: application/json

{
  "chat_id": "uuid-string",
  "skip_interactions": 2,
  "model": "gpt-4o-mini"
}

Response:
{
  "summary": "In the recent discussion, focus shifted to...",
  "usage": {...}
}
```

**Features:**

- ✅ Auto-updates chat titles in database
- ✅ Cost-optimized with `gpt-4o-mini`
- ✅ Detailed token usage tracking
- ✅ Stores insights in `chat_insights` table
- ✅ Handles edge cases gracefully

---

## 🧪 Testing & Development

### **Quick API Tests**

```bash
# Health check
curl http://localhost/api/health

# MCP status check
curl http://localhost/api/mcp/status

# Create a chat
CHAT_ID=$(curl -s -X POST http://localhost/api/chat/create | jq -r '.id')

# Test standard chat streaming
curl -X POST "http://localhost/api/chat/$CHAT_ID" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!","id":"1"}],"model":"gpt-4o"}' \
  --no-buffer

# Test MCP-enabled chat streaming
curl -X POST "http://localhost/api/chat/$CHAT_ID/ai" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How does authentication work?","id":"2"}],"model":"gpt-4o"}' \
  --no-buffer

# Test MCP hot-swap
curl -X POST http://localhost/api/mcp/register \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:8009/sse/","validate_connection":true}'

# Generate chat title
curl -X POST "http://localhost/api/chat/$CHAT_ID/generate-title" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":"'$CHAT_ID'","model":"gpt-4o-mini"}'
```

### **Comprehensive Test Suite**

```bash
# Run complete endpoint validation
./test-api-endpoints.sh

# Run MCP integration tests
uv run python test_mcp_implementation.py

# Compare streaming endpoint formats
uv run python compare_endpoints.py
```

### **Frontend Integration Examples**

#### **React/Next.js Integration**

```typescript
// MCP-aware chat hook
const useMCPChat = (chatId: string) => {
  const [mcpStatus, setMcpStatus] = useState(null);

  useEffect(() => {
    // Monitor MCP status
    fetch("/api/mcp/status")
      .then((r) => r.json())
      .then(setMcpStatus);
  }, []);

  const sendMessage = async (message: string) => {
    const endpoint = mcpStatus?.available
      ? `/api/chat/${chatId}/ai?repository_name=woolly`
      : `/api/chat/${chatId}`;

    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: message, id: Date.now() }],
        model: "gpt-4o",
      }),
    });
  };

  return { sendMessage, mcpStatus };
};
```

#### **Vue.js Integration**

```javascript
// MCP status composable
export const useMCPStatus = () => {
  const status = ref(null);
  const capabilities = ref([]);

  const checkStatus = async () => {
    const response = await fetch("/api/mcp/status");
    const data = await response.json();
    status.value = data.status;
    capabilities.value = data.capabilities || [];
  };

  onMounted(checkStatus);

  return { status, capabilities, checkStatus };
};
```

---

## 🔧 System Architecture & Deployment

### **Core Components**

- **FastAPI Router**: Main application routing
- **Chat Endpoints**: Standard (`/api/chat/{id}`) and MCP-enabled (`/api/chat/{id}/ai`)
- **MCP Registry**: Hot-swappable MCP server management
- **Universal Agent Factory**: Pydantic AI agent creation and execution
- **Streaming Layer**: AI SDK V5 compatible response streaming

### **Key Design Principles**

- 🔄 **Graceful Degradation**: All endpoints work with or without MCP
- 🔥 **Hot-Swappable**: MCP servers can be changed at runtime
- 📡 **Streaming First**: AI SDK V5 compatible streaming throughout
- 🎯 **Frontend Aware**: Headers and status endpoints inform UI state
- 🛡️ **Error Resilient**: Comprehensive error handling and fallbacks

### **Production Deployment**

```env
# Required Environment Variables
DATABASE_URL=postgresql://user:password@localhost/woolly
OPENAI_API_KEY=sk-your-openai-api-key

# Optional - MCP Integration
MCP_SERVER_URL=http://localhost:8009/sse/
```

### **Monitoring & Health Checks**

- `/api/health` - Basic system health
- `/api/mcp/status` - MCP server status with performance metrics
- `/api/v1/agents/health` - Agent system health
- `/api/v1/agents/errors/statistics` - Error tracking

---

## 📚 Additional Resources

- [MCP Hot-Swap Integration Guide](./MCP-Hot-Swap-Integration-Guide.md)
- [API Endpoints Analysis](./API-Endpoints-Analysis.md)
- Test Scripts: `./test-api-endpoints.sh`, `test_mcp_implementation.py`, `compare_endpoints.py`

---

**🎉 The Woolly Backend API provides a robust, scalable foundation for AI-powered applications with seamless MCP integration and comprehensive frontend support.**
