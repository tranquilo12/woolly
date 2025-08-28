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
MCP_SERVER_URL=http://localhost:8009/sse/
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

## API Endpoints

### Health Check

#### `GET /api/health`

Basic health check endpoint.

**Response:**

```json
{ "status": "healthy" }
```

---

## Chat Management

### Create Chat

#### `POST /api/chat/create`

Create a new chat session.

**Parameters:**

- `agent_id` (optional): Associate chat with a specific agent

**Response:**

```json
{ "id": "uuid-string" }
```

### List Chats

#### `GET /api/chats`

Retrieve all chat sessions ordered by last updated.

**Response:**

```json
[
  {
    "id": "uuid-string",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "title": "Chat Title"
  }
]
```

### Delete Chat

#### `DELETE /api/chat/{chat_id}`

Delete a chat and all its messages.

**Response:**

```json
{ "success": true }
```

### Update Chat Title

#### `PATCH /api/chat/{chat_id}/title`

Update chat title.

**Request Body:**

```json
{ "title": "New Chat Title" }
```

**Response:**

```json
{ "success": true, "title": "New Chat Title" }
```

---

## Messages

### Get Messages

#### `GET /api/chat/{chat_id}/messages`

Get all messages for a chat (excludes agent messages).

**Response:**

```json
[
  {
    "id": "uuid-string",
    "chat_id": "uuid-string",
    "role": "user|assistant",
    "content": "Message content",
    "model": "gpt-4o",
    "created_at": "2024-01-01T00:00:00Z",
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300,
    "tool_invocations": []
  }
]
```

### Create Message

#### `POST /api/chat/{chat_id}/messages`

Create a new message in a chat.

**Request Body:**

```json
{
  "role": "user|assistant",
  "content": "Message content",
  "toolInvocations": [],
  "prompt_tokens": 100,
  "completion_tokens": 200,
  "total_tokens": 300
}
```

### Edit Message

#### `PATCH /api/chat/{chat_id}/messages/{message_id}`

Edit a message and remove all subsequent messages.

**Request Body:**

```json
{ "content": "Updated message content" }
```

### Delete Message

#### `DELETE /api/chat/{chat_id}/messages/{message_id}`

Delete a specific message.

**Response:**

```json
{ "success": true }
```

### Update Message Model

#### `PATCH /api/chat/{chat_id}/messages/{message_id}/model`

Update the AI model used for a message.

**Request Body:**

```json
{ "model": "gpt-4o" }
```

---

## Chat Utilities (AI-Powered)

### Generate Chat Title

#### `POST /api/chat/{chat_id}/generate-title`

Generate a concise 2-3 word title from the first user message using AI.

**Request Body:**

```json
{
  "chat_id": "uuid-string",
  "model": "gpt-4o-mini"
}
```

**Response:**

```json
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

**Features:**

- Automatically updates chat title in database
- Uses efficient `gpt-4o-mini` model by default
- Returns detailed token usage information
- Handles edge cases (empty messages, etc.)
- Stores generated titles in `chat_insights` table for audit trail

### Generate Full Summary

#### `POST /api/chat/{chat_id}/generate-summary`

Generate a comprehensive summary of the entire conversation using AI.

**Request Body:**

```json
{
  "chat_id": "uuid-string",
  "model": "gpt-4o-mini"
}
```

**Response:**

```json
{
  "chat_id": "uuid-string",
  "summary": "The conversation covered authentication implementation, discussing JWT tokens, session management, and security best practices. Key decisions included using bcrypt for password hashing and implementing refresh token rotation.",
  "model": "gpt-4o-mini",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 45,
    "total_tokens": 195
  }
}
```

**Features:**

- Summarizes all user and assistant messages
- Captures key decisions, requests, and action items
- Optimized for cost-efficiency with `gpt-4o-mini`
- Returns empty summary for chats with no messages
- Stores generated summaries in `chat_insights` table for future reference

### Generate Rolling Summary

#### `POST /api/chat/{chat_id}/generate-rolling-summary`

Generate a summary of the conversation while skipping the first N interactions (user+assistant pairs).

**Request Body:**

```json
{
  "chat_id": "uuid-string",
  "skip_interactions": 2,
  "model": "gpt-4o-mini"
}
```

**Response:**

```json
{
  "chat_id": "uuid-string",
  "summary": "In the recent discussion, the focus shifted to implementing security measures including rate limiting and input validation. The assistant provided code examples for middleware implementation and discussed deployment considerations.",
  "model": "gpt-4o-mini",
  "usage": {
    "prompt_tokens": 120,
    "completion_tokens": 38,
    "total_tokens": 158
  }
}
```

**Features:**

- Skips first N interactions to focus on recent context
- Groups messages into logical user+assistant interactions
- Handles edge cases (insufficient messages defaults to full summary)
- Optimized for rolling context windows in long conversations
- Stores rolling summaries with metadata in `chat_insights` table

**All Chat Utility Endpoints:**

- ✅ **Async/Concurrent**: All endpoints handle parallel requests efficiently
- ✅ **Error Handling**: Proper 404 responses for missing chats
- ✅ **Cost Optimized**: Uses `gpt-4o-mini` for efficiency
- ✅ **Usage Tracking**: Detailed token consumption reporting
- ✅ **Stateless**: No chat state maintenance required
- ✅ **Data Persistence**: All generated insights stored in `chat_insights` table
- ✅ **Response Validation**: Returns `chat_id` to confirm correct data processing

### Data Storage

All AI-generated insights (titles, summaries) are automatically stored in the `chat_insights` database table with:

- **Full audit trail**: Model used, token counts, timestamps
- **Insight categorization**: `title`, `summary`, `rolling_summary` types
- **Rolling summary metadata**: Tracks `skip_interactions` parameter
- **Relationship mapping**: Linked to parent chat for easy retrieval
- **Usage analytics**: Token consumption tracking for cost analysis

**Database Schema:**

```sql
CREATE TABLE chat_insights (
    id UUID PRIMARY KEY,
    chat_id UUID REFERENCES chats(id),
    insight_type VARCHAR NOT NULL,  -- 'title', 'summary', 'rolling_summary'
    content TEXT NOT NULL,
    model_used VARCHAR NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    skip_interactions INTEGER,      -- For rolling summaries
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

---

## Chat Interaction (Streaming)

### Main Chat Endpoint

#### `POST /api/chat/{chat_id}`

Main chat endpoint with streaming response support.

**Parameters:**

- `protocol`: Query parameter (default: "data")

**Request Body:**

```json
{
  "messages": [
    {
      "role": "user|assistant",
      "content": "Message content",
      "id": "optional-id",
      "toolInvocations": [],
      "model": "gpt-4o",
      "experimental_attachments": [
        {
          "contentType": "image/jpeg",
          "url": "data:image/jpeg;base64,..."
        }
      ]
    }
  ],
  "model": "gpt-4o",
  "agent_id": "optional-agent-id"
}
```

**Response:** Streaming response compatible with AI SDK V5

### Pydantic AI Chat Endpoint (NEW)

#### `POST /api/chat/{chat_id}/ai`

**🚀 NEW**: Advanced chat endpoint with full MCP integration and code-aware responses.

**Parameters:**

- `repository_name`: Query parameter (default: "woolly") - Repository context for MCP tools

**Request Body:** Same as main chat endpoint

**Response:** AI SDK V5 streaming with enhanced headers

**Enhanced Response Headers:**

```http
X-Chat-Type: pydantic-ai
X-MCP-Enabled: true|false
X-MCP-Status: healthy|degraded|failed
X-MCP-Fallback: true|false
X-MCP-Capabilities: search_code,find_entities,qa_codebase,generate_diagram
X-Repository: woolly
```

**Features:**

- ✅ **Full MCP Tool Access**: Automatic code analysis capabilities
- ✅ **Intelligent Tool Detection**: Automatically uses MCP tools for code-related queries
- ✅ **Graceful Fallback**: Works even when MCP server unavailable
- ✅ **Status Transparency**: Headers inform frontend of MCP availability
- ✅ **Same Interface**: Drop-in replacement for regular chat endpoint
- ✅ **AI SDK V5 Compatible**: Maintains streaming format compatibility

**Available MCP Tools:**

- `search_code`: Semantic code search across repository
- `find_entities`: Discover classes, functions, files, and modules
- `get_entity_relationships`: Map dependencies and relationships
- `qa_codebase`: Comprehensive codebase insights and analysis
- `generate_diagram`: Create visual representations (Mermaid diagrams)

**Example Usage:**

```bash
# Code-aware chat with MCP tools
curl -X POST "http://localhost/api/chat/{chat_id}/ai" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "How does the Universal Agent Factory work?",
        "id": "msg-1"
      }
    ]
  }'
```

**When to Use:**

- Code analysis and exploration
- Architecture questions
- Implementation guidance
- Repository-specific queries
- Technical documentation needs

### Legacy Chat Endpoint

#### `POST /api/chat`

Legacy endpoint for backward compatibility.

**Request Body:** Same as main chat endpoint

---

## MCP Server Status (NEW)

### Get MCP Status

#### `GET /api/mcp/status`

**🚀 NEW**: Real-time MCP server status and capabilities for frontend integration.

**Response:**

```json
{
  "status": "healthy|degraded|failed|unknown|connecting|retrying",
  "available": true,
  "capabilities": [
    "search_code",
    "find_entities",
    "get_entity_relationships",
    "qa_codebase",
    "generate_diagram"
  ],
  "server_info": {
    "url": "http://localhost:8009/sse/",
    "version": "2.9",
    "response_time_ms": 150.5,
    "last_check": "2024-01-01T00:00:00Z"
  },
  "fallback_mode": false,
  "last_check": "2024-01-01T00:00:00Z",
  "next_retry": null,
  "error_details": {
    "message": "Connection timeout",
    "error_count": 3,
    "consecutive_failures": 2,
    "last_success": "2024-01-01T00:00:00Z"
  }
}
```

**Status Values:**

- `healthy`: MCP server fully operational
- `degraded`: MCP server partially working (some tools may fail)
- `failed`: MCP server completely unavailable
- `unknown`: Status not yet determined
- `connecting`: Currently establishing connection
- `retrying`: Attempting to reconnect after failure

**Features:**

- ✅ **Real-time Monitoring**: Background monitoring with automatic status updates
- ✅ **Capability Detection**: Lists available MCP tools
- ✅ **Error Details**: Comprehensive failure information for debugging
- ✅ **Response Metrics**: Performance monitoring with response times
- ✅ **Retry Logic**: Exponential backoff with intelligent retry scheduling
- ✅ **Frontend Ready**: Structured data perfect for UI status indicators

**Frontend Integration:**

```javascript
// Check MCP status for UI indicators
const mcpStatus = await fetch("/api/mcp/status").then((r) => r.json());

if (mcpStatus.available) {
  // Show code analysis features
  showCodeAnalysisTools(mcpStatus.capabilities);
} else {
  // Show fallback message
  showFallbackMessage(mcpStatus.error_details?.message);
}
```

**Use Cases:**

- Frontend status indicators
- Feature availability detection
- Error reporting and diagnostics
- Performance monitoring
- Automatic fallback handling

---

## Agent Management

### Create Agent

#### `POST /api/agents`

Create a new AI agent.

**Request Body:**

```json
{
  "name": "Agent Name",
  "description": "Agent description",
  "system_prompt": "System prompt for the agent",
  "tools": ["tool1", "tool2"],
  "repository": "optional-repo-name"
}
```

**Response:**

```json
{
  "id": "uuid-string",
  "name": "Agent Name",
  "description": "Agent description",
  "system_prompt": "System prompt",
  "tools": ["tool1", "tool2"],
  "created_at": "2024-01-01T00:00:00Z",
  "is_active": true,
  "repository": "repo-name"
}
```

### List Agents

#### `GET /api/agents`

List all agents with optional filtering.

**Parameters:**

- `repository` (optional): Filter by repository
- `type` (optional): Filter by agent type

### Get Agent

#### `GET /api/agents/{agent_id}`

Get a specific agent by ID.

### Update Agent

#### `PATCH /api/agents/{agent_id}`

Update an agent.

**Request Body:**

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "system_prompt": "Updated prompt",
  "tools": ["updated-tools"],
  "is_active": true
}
```

### Delete Agent

#### `DELETE /api/agents/{agent_id}`

Delete an agent.

### Agent Health Check

#### `GET /api/agents/health`

Health check for the agent system.

**Response:**

```json
{
  "status": "healthy",
  "system": "simplified_agent_system",
  "version": "2.0",
  "endpoints": {
    "agent_crud": "✅ Active",
    "universal_system": "✅ Available at /api/v1/agents/execute",
    "deprecated_generate": "⚠️ Deprecated - Use universal system"
  }
}
```

---

## Universal Agent System

### Execute Multiple Agents

#### `POST /api/v1/agents/execute`

Execute multiple agents in parallel or background.

**Request Body:**

```json
{
  "repository_name": "woolly",
  "user_query": "Analyze the authentication system",
  "agent_types": ["simplifier", "tester", "convo_starter", "summarizer"],
  "context": {},
  "run_in_background": false,
  "enable_streaming": true,
  "chat_id": "optional-uuid",
  "agent_id": "optional-uuid"
}
```

**Response (Immediate):**

```json
{
  "status": "completed",
  "agent_count": 4,
  "results": {
    "simplifier": {
      "content": "Simplified analysis...",
      "metadata": {}
    }
  },
  "message": "Successfully executed 4 agents"
}
```

**Response (Background):**

```json
{
  "status": "started",
  "agent_count": 4,
  "session_id": "session-uuid",
  "message": "Background execution started for 4 agents"
}
```

### Execute Agents with Streaming

#### `POST /api/v1/agents/execute/streaming`

Execute agents with real-time streaming.

**Request Body:** Same as above

**Response:** Streaming response with real-time agent results

### Execute Single Agent

#### `POST /api/v1/agents/execute/single`

Execute a single agent with optional streaming.

**Request Body:**

```json
{
  "repository_name": "woolly",
  "user_query": "Analyze the authentication system",
  "agent_type": "simplifier",
  "context": {},
  "enable_streaming": true,
  "chat_id": "optional-uuid",
  "agent_id": "optional-uuid"
}
```

### Session Management

#### `GET /api/v1/agents/session/{session_id}`

Get status of background agent session.

**Response:**

```json
{
  "status": "running|completed|failed",
  "progress": 0.75,
  "completed_agents": ["simplifier", "tester"],
  "remaining_agents": ["convo_starter", "summarizer"],
  "results": {}
}
```

#### `DELETE /api/v1/agents/session/{session_id}`

Cancel background agent session.

### Task Management

#### `GET /api/v1/agents/task/{task_id}`

Get status of individual agent task.

#### `POST /api/v1/agents/task/{task_id}/retry`

Retry a failed task.

### System Information

#### `GET /api/v1/agents/types`

Get available agent types with descriptions.

**Response:**

```json
{
  "agent_types": [
    "simplifier",
    "tester",
    "convo_starter",
    "summarizer",
    "documentation"
  ],
  "descriptions": {
    "simplifier": "Simplifies complex code and documentation",
    "tester": "Generates tests and analyzes test coverage",
    "convo_starter": "Creates conversation starters and questions",
    "summarizer": "Summarizes code and documentation",
    "documentation": "Generates comprehensive documentation"
  },
  "total_count": 5
}
```

#### `GET /api/v1/agents/health`

Universal agent system health check.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "factory": {
    "status": "healthy",
    "mcp_available": true,
    "available_agents": 5
  },
  "parallel_manager": {
    "status": "healthy",
    "active_sessions": 2,
    "active_tasks": 5
  },
  "available_agents": 5
}
```

### Testing & Diagnostics

#### `GET /api/v1/agents/mcp/test`

Test MCP server connection.

**Response:**

```json
{
  "status": "completed",
  "timestamp": "2024-01-01T00:00:00Z",
  "test_result": {
    "connection": "successful",
    "tools_available": ["search_code", "find_entities", "qa_codebase"],
    "latency_ms": 150
  }
}
```

#### `GET /api/v1/agents/errors/statistics`

Get error statistics for monitoring.

#### `POST /api/v1/agents/errors/reset`

Reset error statistics.

---

## Triage Agent System

### Analyze Query

#### `POST /api/v1/triage/analyze`

Analyze a query without executing agents.

**Request Body:**

```json
{
  "repository_name": "woolly",
  "user_query": "How does authentication work?",
  "user_context": {},
  "conversation_history": []
}
```

**Response:**

```json
{
  "triage_decision": "single_agent",
  "reasoning": "This query requires code analysis which is best handled by the documentation agent",
  "confidence": 0.85,
  "recommended_agents": ["documentation"],
  "context_for_agents": {},
  "direct_response": null
}
```

### Execute Triage

#### `POST /api/v1/triage/execute`

Execute triage analysis and run appropriate agents.

**Request Body:**

```json
{
  "repository_name": "woolly",
  "user_query": "How does authentication work?",
  "user_context": {},
  "conversation_history": [],
  "chat_id": "optional-uuid",
  "agent_id": "optional-uuid"
}
```

**Response:**

```json
{
  "triage_decision": "single_agent",
  "reasoning": "Query requires code analysis",
  "confidence": 0.85,
  "recommended_agents": ["documentation"],
  "result": "Authentication is implemented using...",
  "execution_time": 5.2,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Execute Triage with Streaming

#### `POST /api/v1/triage/execute/streaming`

Execute triage with streaming response.

**Response:** Streaming response with triage decisions and agent results

### Triage System Status

#### `GET /api/v1/triage/health`

Triage system health check.

**Response:**

```json
{
  "status": "healthy",
  "triage_agent": "healthy",
  "mcp_server": "available",
  "available_agents": [
    "simplifier",
    "tester",
    "convo_starter",
    "summarizer",
    "documentation"
  ],
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### `GET /api/v1/triage/stats`

Get triage system statistics.

---

## Agent Messages

### Get Agent Messages

#### `GET /api/chat/{chat_id}/agent/messages`

Get agent messages for a chat with filtering.

**Parameters:**

- `agent_id` (optional): Filter by agent ID
- `repository` (optional): Filter by repository
- `message_type` (optional): Filter by message type
- `pipeline_id` (optional): Filter by pipeline ID

### Create Agent Message

#### `POST /api/chat/{chat_id}/agent/messages`

Create a new agent message.

**Request Body:**

```json
{
  "agent_id": "uuid-string",
  "repository": "woolly",
  "message_type": "agent_result",
  "pipeline_id": "optional-pipeline-id",
  "role": "assistant",
  "content": "Agent response content",
  "model": "universal-agent-system",
  "tool_invocations": [],
  "iteration_index": 1,
  "step_index": 2,
  "step_title": "Analysis Step"
}
```

---

## Streaming Demo

### Mock Streaming

#### `POST /api/streaming/mock`

Mock streaming endpoint for testing AI SDK V5 compatibility.

**Request Body:**

```json
{ "prompt": "authentication system" }
```

**Response:** Streaming response with mock tool calls and text

### Test Streaming Format

#### `GET /api/streaming/test`

Test endpoint showing streaming format examples and validation.

---

## Available Tools

### Python Code Execution

- **Tool Name**: `execute_python_code`
- **Description**: Execute Python code in a sandboxed environment
- **Parameters**:
  - `code`: Python code to execute
  - `output_format`: Format of the output

### MCP Tools (via Universal Agent System)

- **search_code**: Semantic code search
- **find_entities**: Discover functions, classes, files
- **get_entity_relationships**: Map code relationships
- **qa_codebase**: Holistic codebase analysis
- **generate_diagram**: Create Mermaid diagrams

---

## Testing the API

### Comprehensive Test Suite

A complete test script is available that validates all API endpoints:

```bash
# Run the complete test suite
./test-api-endpoints.sh
```

This script tests:

- All health check endpoints
- Chat and message CRUD operations
- Agent management operations
- Universal agent system endpoints
- Triage system endpoints
- Streaming functionality
- Error handling and diagnostics

### Manual Testing Examples

```bash
# Health check
curl http://localhost/api/health

# Create a chat
curl -X POST http://localhost/api/chat/create

# Test streaming (working)
curl -X POST http://localhost/api/streaming/mock \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}' \
  --no-buffer

# Test agent types (working)
curl http://localhost/api/v1/agents/types

# Test MCP connection status (legacy)
curl http://localhost/api/v1/agents/mcp/test

# Test MCP status (NEW - recommended)
curl http://localhost/api/mcp/status

# Test Pydantic AI chat (NEW)
curl -X POST "http://localhost/api/chat/{chat_id}/ai" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How does authentication work?","id":"1"}]}'

# Test chat utility endpoints
# Generate title for a chat
curl -X POST http://localhost/api/chat/{chat_id}/generate-title \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "your-chat-uuid", "model": "gpt-4o-mini"}'

# Generate full summary
curl -X POST http://localhost/api/chat/{chat_id}/generate-summary \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "your-chat-uuid", "model": "gpt-4o-mini"}'

# Generate rolling summary (skip first 2 interactions)
curl -X POST http://localhost/api/chat/{chat_id}/generate-rolling-summary \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "your-chat-uuid", "skip_interactions": 2, "model": "gpt-4o-mini"}'
```

### Current API Status

#### ✅ **Fully Working Endpoints**

- **Health Checks**: All system health endpoints operational
- **Chat Management**: Create, read, update, delete chats
- **Chat Utilities**: AI-powered title generation, full summaries, rolling summaries
- **Pydantic AI Chat**: NEW code-aware chat with MCP integration (`/api/chat/{id}/ai`)
- **MCP Status API**: NEW real-time MCP server monitoring (`/api/mcp/status`)
- **Message Management**: Full CRUD operations for messages
- **Agent Management**: Complete agent CRUD functionality
- **System Information**: Agent types, health status, MCP testing
- **Streaming Demo**: Mock streaming with AI SDK V5 format
- **Basic Streaming**: Single agent streaming initiation

#### ⚠️ **Known Issues**

- **Agent Execution**: Some agent execution endpoints return 500 errors
- **MCP Dependency**: Agent execution requires MCP server on `localhost:8009`
- **Async Tasks**: Some background task operations need debugging

#### 🔧 **Dependencies**

- **MCP Server**: Optional for enhanced functionality (graceful fallback when unavailable)
- **PostgreSQL**: Database must be running and migrated
- **OpenAI API**: Required for AI model interactions and chat utilities
- **Pydantic AI**: Powers the new chat utility endpoints and MCP integration (v0.4.6+)

#### 🚀 **NEW: Enhanced MCP Integration**

- **Graceful Degradation**: System works with or without MCP server
- **Real-time Monitoring**: Automatic MCP status tracking with `/api/mcp/status`
- **Frontend Awareness**: Headers inform frontend of MCP availability
- **Intelligent Fallbacks**: Seamless transition between MCP and regular chat modes

---

## Troubleshooting

### Common Issues

#### Agent Execution Errors (500 Internal Server Error)

**Problem**: Agent execution endpoints return 500 errors
**Cause**: MCP server not running or connection issues
**Solution**:

```bash
# Check if MCP server is running
curl http://localhost:8009/sse/

# Test MCP connection through API
curl http://localhost/api/v1/agents/mcp/test
```

#### Database Connection Issues

**Problem**: Database-related errors
**Solution**:

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Run migrations if needed
alembic upgrade head
```

#### OpenAI API Issues

**Problem**: AI model execution fails
**Solution**:

```bash
# Verify API key is set
echo $OPENAI_API_KEY

# Test API key validity
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Running the Test Suite

The test script provides detailed output about which endpoints are working:

```bash
# Run with verbose output
./test-api-endpoints.sh

# Check specific endpoint manually
curl -v http://localhost/api/v1/agents/health
```

### Expected Test Results

- ✅ **Health checks**: Should all return 200 OK
- ✅ **CRUD operations**: Chat, message, and agent operations should work
- ✅ **Chat utilities**: Title generation, summaries should work with valid OpenAI API key
- ✅ **Streaming demo**: Mock streaming should show V5 format
- ⚠️ **Agent execution**: May fail if MCP server unavailable
- ⚠️ **Triage system**: Depends on agent execution functionality

---

## Error Handling

The API uses standard HTTP status codes:

- `200`: Success
- `400`: Bad Request
- `404`: Not Found
- `409`: Conflict (e.g., duplicate agent name)
- `500`: Internal Server Error

All error responses include a `detail` field with a descriptive error message.

### Error Response Format

```json
{
  "detail": "Descriptive error message explaining what went wrong"
}
```

---

## Notes

### API Status

- **Core functionality**: All basic CRUD operations are fully functional
- **Streaming support**: Real-time responses compatible with AI SDK V5 format
- **Authentication**: Currently operates without authentication in development mode
- **Agent system**: Basic agent management works; execution depends on MCP server availability

### Testing

- **Comprehensive test suite**: Use `./test-api-endpoints.sh` to validate all endpoints
- **Automated validation**: Script tests all documented endpoints and provides status reports
- **Error identification**: Test suite clearly identifies which endpoints are working vs. failing

### Architecture

- **Agent messages**: Separate from regular chat messages and can be filtered independently
- **AI-powered utilities**: Chat title generation and summarization using Pydantic AI
- **Background processing**: Session tracking available for long-running operations
- **Intelligent routing**: Triage system routes queries to appropriate specialist agents
- **Modular design**: Core API functionality independent of agent execution layer
- **Concurrent processing**: All chat utility endpoints support parallel execution

### Development

- **MCP dependency**: Full agent functionality requires MCP server on port 8009
- **Database migrations**: Use Alembic for schema management
- **Environment setup**: Requires PostgreSQL, OpenAI API key, and optional MCP server
- **AI utilities**: Chat utilities require valid OpenAI API key and Pydantic AI (v0.4.6+)
