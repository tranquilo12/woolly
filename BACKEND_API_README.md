# 🚀 Woolly Backend API Documentation

## Overview

This is a comprehensive guide to the Woolly Backend API, a sophisticated FastAPI-based system designed for AI-powered code analysis and documentation generation. The backend features a modern architecture with streaming support, agent-based processing, and MCP (Model Context Protocol) integration.

## 🏗️ Architecture

- **Framework**: FastAPI with async/await support
- **Database**: PostgreSQL with SQLAlchemy ORM
- **AI Integration**: OpenAI GPT models with Pydantic AI framework
- **Agent System**: Universal agent factory pattern with specialized AI agents
- **Streaming**: Real-time Server-Sent Events (SSE) compatible with AI SDK V5
- **Tools**: Python code execution, MCP tool integration

## 🔧 Technology Stack

```
FastAPI 0.115.11
OpenAI 1.65.4
Pydantic 2.10.6
Pydantic AI 0.0.35
SQLAlchemy 2.0.29
PostgreSQL (psycopg2-binary)
Alembic (database migrations)
```

## 📊 Core Data Models

### Chat System

- **Chat**: Conversation container with title, timestamps, and agent association
- **Message**: Individual messages with role, content, tool invocations, and token counts
- **Agent**: AI agent configurations with system prompts and tool access

### Agent System

- **Universal Agents**: Standardized agent types (Simplifier, Tester, ConvoStarter, Summarizer, Documentation)
- **Triage Agent**: Intelligent routing agent that selects appropriate specialist agents
- **Tool Budget**: Resource management for agent execution

---

## 🚦 API Endpoints

### Health & Status

#### `GET /api/health`

Basic health check endpoint for Docker health monitoring.

**Response:**

```json
{
  "status": "healthy"
}
```

---

## 💬 Chat Management

### Chat CRUD Operations

#### `POST /api/chat/create`

Create a new chat session.

**Parameters:**

- `agent_id` (optional): Associate chat with a specific agent

**Response:**

```json
{
  "id": "uuid-string"
}
```

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

#### `DELETE /api/chat/{chat_id}`

Delete a chat and all its messages.

**Response:**

```json
{
  "success": true
}
```

### Chat Title Management

#### `PATCH /api/chat/{chat_id}/title`

Update chat title.

**Request Body:**

```json
{
  "title": "New Chat Title"
}
```

**Response:**

```json
{
  "success": true,
  "title": "New Chat Title"
}
```

---

## 📝 Message Management

### Message Operations

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

#### `PATCH /api/chat/{chat_id}/messages/{message_id}`

Edit a message and remove all subsequent messages.

**Request Body:**

```json
{
  "content": "Updated message content"
}
```

#### `DELETE /api/chat/{chat_id}/messages/{message_id}`

Delete a specific message.

**Response:**

```json
{
  "success": true
}
```

### Model Updates

#### `PATCH /api/chat/{chat_id}/messages/{message_id}/model`

Update the AI model used for a message.

**Request Body:**

```json
{
  "model": "gpt-4o"
}
```

---

## 🤖 Chat Interaction (Streaming)

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

**Response:** Streaming response with AI SDK V5 compatible format:

- Text chunks: `0:"text content"`
- Tool calls: `9:{"toolCallId":"id","toolName":"name","args":{},"state":"partial-call"}`
- Tool results: `a:{"toolCallId":"id","result":{},"state":"result"}`
- End stream: `e:{"finishReason":"stop","usage":{"promptTokens":100,"completionTokens":200,"totalTokens":300},"isContinued":false}`

**V5 Improvements:**
- Removed V4-specific headers (`x-vercel-ai-data-stream`)
- Added `totalTokens` to usage statistics
- Cleaner streaming response format
- Enhanced tool call structure

### Legacy Chat Endpoint

#### `POST /api/chat`

Legacy endpoint for backward compatibility.

**Request Body:** Same as main chat endpoint

---

## 🧠 Agent Management

### Agent CRUD Operations

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

#### `GET /api/agents`

List all agents with optional filtering.

**Parameters:**

- `repository` (optional): Filter by repository
- `type` (optional): Filter by agent type

#### `GET /api/agents/{agent_id}`

Get a specific agent by ID.

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

## 🌟 Universal Agent System

### Agent Execution

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

#### `POST /api/v1/agents/execute/streaming`

Execute agents with real-time streaming.

**Request Body:** Same as above

**Response:** Server-Sent Events stream:

```
data: {"status": "started", "agent_count": 4}

data: {"type": "agent_stream", "agent_type": "simplifier", "data": {...}}

data: {"status": "all_completed"}
```

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

**Response:**

```json
{
  "status": "cancelled",
  "session_id": "session-uuid"
}
```

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

**Response:**

```json
{
  "total_errors": 5,
  "error_types": {
    "connection_timeout": 3,
    "tool_execution_failed": 2
  },
  "recovery_rate": 0.8,
  "last_error": "2024-01-01T00:00:00Z"
}
```

#### `POST /api/v1/agents/errors/reset`

Reset error statistics.

---

## 🎯 Triage Agent System

### Triage Analysis

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

#### `POST /api/v1/triage/execute/streaming`

Execute triage with streaming response.

**Response:** Server-Sent Events:

```
data: {"type": "analysis_start", "message": "Analyzing query..."}

data: {"type": "triage_decision", "decision": "single_agent", "reasoning": "...", "confidence": 0.85}

data: {"type": "agent_start", "agent": "documentation"}

data: {"type": "agent_result", "agent": "documentation", "content": "..."}

data: {"type": "complete"}
```

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

**Response:**

```json
{
  "total_queries": 150,
  "decisions_by_type": {
    "single_agent": 80,
    "multi_agent": 60,
    "direct_response": 10
  },
  "average_confidence": 0.82,
  "average_execution_time": 4.5,
  "most_used_agents": ["documentation", "simplifier"],
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

## 🔄 Streaming POC Endpoints

### Streaming Demo

#### `POST /api/streaming/mock`

Mock streaming endpoint for testing AI SDK V5 compatibility.

**Request Body:**

```json
{
  "prompt": "authentication system"
}
```

**Response:** Server-Sent Events with mock tool calls and text streaming

#### `GET /api/streaming/test`

Test SSE format validation.

**Response:**

```json
{
  "example_events": [
    { "type": "text", "delta": "Hello" },
    {
      "type": "toolCall",
      "id": "test_1",
      "name": "test_tool",
      "args": { "param": "value" }
    },
    {
      "type": "toolResult",
      "id": "test_1",
      "result": "Tool executed successfully"
    },
    { "type": "done" }
  ],
  "sse_format_example": "data: {\"type\": \"text\", \"delta\": \"Hello\"}\\n\\n"
}
```

---

## 📊 Agent Message System

### Agent Message Operations

#### `GET /api/chat/{chat_id}/agent/messages`

Get agent messages for a chat with filtering.

**Parameters:**

- `agent_id` (optional): Filter by agent ID
- `repository` (optional): Filter by repository
- `message_type` (optional): Filter by message type
- `pipeline_id` (optional): Filter by pipeline ID

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

## 📋 Documentation Endpoints

### System Prompts

#### `GET /api/docs_system_prompt.txt`

Get the documentation system prompt template.

### Legacy Documentation (Deprecated)

#### `GET /strategies`

List available documentation strategies (legacy).

#### `GET /strategies/{strategy_name}`

Get strategy details (legacy).

**Note:** These endpoints are deprecated. Use the Universal Agent System instead.

---

## 🛠️ Available Tools

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

## 🔐 Authentication & Security

The API currently operates without authentication for development purposes. In production, implement:

- JWT token authentication
- Role-based access control
- Rate limiting
- Input validation and sanitization

---

## ⚡ Performance Considerations

### Streaming Support

- All chat endpoints support real-time streaming
- **Upgraded to AI SDK V5 compatibility**
- Server-Sent Events (SSE) protocol
- Automatic token usage tracking with `totalTokens`
- Removed legacy V4 headers for cleaner responses

### Resource Management

- Tool budget system for agent execution
- Background task processing
- Session management for long-running operations
- Automatic cleanup of completed tasks

### Database Optimization

- Indexed queries for chat and message retrieval
- Proper foreign key relationships
- Efficient message grouping and filtering

---

## 🔄 AI SDK V5 Upgrade

### What Changed

The Woolly Backend API has been **fully upgraded** from Vercel AI SDK V4 to **AI SDK V5** format. This upgrade ensures compatibility with modern AI SDK frontends while maintaining all existing functionality.

### Key V5 Improvements

#### **Streaming Response Format**
- ✅ **Removed V4 Headers**: No more `x-vercel-ai-data-stream: v1` headers
- ✅ **Enhanced Usage Stats**: Added `totalTokens` to all usage responses
- ✅ **Cleaner Format**: Standardized streaming response structure
- ✅ **Better Tool Calls**: Improved tool call and result formatting

#### **Updated Endpoints**
- ✅ **Main Chat**: `/api/chat/{chat_id}` - Full V5 compatibility
- ✅ **Legacy Chat**: `/api/chat` - V5 compatible
- ✅ **Universal Agents**: `/api/v1/agents/execute/streaming` - V5 SSE format
- ✅ **Triage Streaming**: `/api/v1/triage/execute/streaming` - V5 SSE format
- ✅ **Streaming POC**: `/api/streaming/mock` - V5 compatible

#### **Technical Changes**
- ✅ **Core Functions**: Updated `build_tool_call_*` functions for V5
- ✅ **Response Headers**: Removed V4-specific headers, added proper media types
- ✅ **Token Counting**: Enhanced with `totalTokens` calculation
- ✅ **Error Handling**: Maintained robust error handling throughout

### Migration Benefits

1. **Future-Proof**: Compatible with latest AI SDK versions
2. **Cleaner Code**: Removed legacy V4 dependencies
3. **Better Performance**: Streamlined response format
4. **Enhanced Monitoring**: Improved token usage tracking
5. **Consistent Format**: Standardized across all streaming endpoints

### Backward Compatibility

⚠️ **Breaking Change**: This upgrade removes V4 compatibility. Ensure your frontend is using AI SDK V5 before deploying.

### Testing V5 Endpoints

```bash
# Test main chat streaming (V5)
curl -X POST "http://localhost/api/chat/{chat_id}" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello V5!", "id": "test-1"}],
    "model": "gpt-4o"
  }' --no-buffer

# Test agent streaming (V5)
curl -X POST "http://localhost/api/v1/agents/execute/streaming" \
  -H "Content-Type: application/json" \
  -d '{
    "repository_name": "woolly",
    "user_query": "test V5 agents",
    "agent_types": ["documentation"]
  }' --no-buffer

# Test streaming POC (V5)
curl -X POST "http://localhost/api/streaming/mock" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test V5 streaming"}' --no-buffer
```

---

## 🚀 Getting Started

### Prerequisites

1. Python 3.8+
2. PostgreSQL database
3. OpenAI API key
4. MCP server running (optional but recommended)

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

### Testing the API

```bash
# Health check
curl http://localhost:8000/api/health

# Create a chat
curl -X POST http://localhost:8000/api/chat/create

# Test streaming
curl -X POST http://localhost:8000/api/streaming/mock \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}' \
  --no-buffer
```

---

## 📈 Monitoring & Debugging

### Health Checks

- Main API: `/api/health`
- Agent System: `/api/v1/agents/health`
- Triage System: `/api/v1/triage/health`

### Error Tracking

- Error statistics: `/api/v1/agents/errors/statistics`
- Session status: `/api/v1/agents/session/{session_id}`
- Task status: `/api/v1/agents/task/{task_id}`

### Logging

- Structured logging with Python logging module
- Request/response logging for debugging
- Tool execution logging for performance analysis

---

This comprehensive API provides a robust foundation for building AI-powered frontend applications with real-time streaming, intelligent agent routing, and sophisticated code analysis capabilities.
