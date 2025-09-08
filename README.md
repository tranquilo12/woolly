# Woolly

FastAPI + Next.js platform for AI-powered, code-aware assistance with MCP integration, multi-agent orchestration, and AI SDK V5 streaming.

<details>
<summary><strong>🚀 Backend Quickstart</strong></summary>

### Prerequisites

- Python 3.8+
- PostgreSQL database
- OpenAI API key

### Setup Steps

1. **Install Python dependencies**

```bash
pip install -r api/requirements.txt
```

2. **Set environment variables**

```env
DATABASE_URL=postgresql://user:password@localhost/woolly
OPENAI_API_KEY=your-openai-api-key
```

> **Note**: `MCP_SERVER_URL` is no longer required. MCP servers are now managed dynamically via the registry API.

3. **Initialize database and run**

```bash
alembic upgrade head
uvicorn api.index:app --host 0.0.0.0 --port 8000 --reload
```

### MCP Server Setup

MCP servers are now registered dynamically via API endpoints:

```bash
# Register an MCP server
curl -X POST "http://localhost:8000/api/v2/mcp/register" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://localhost:8009/sse/"}'

# Check MCP status
curl "http://localhost:8000/api/v2/mcp/status"
```

### ✅ Backend Validation

Our comprehensive test suite validates all backend functionality:

```bash
# Run complete backend tests
uv run python test_backend_changes.py
```

**Latest Test Results**: ✅ **15/15 tests passed (100% success rate)**

- Health & System endpoints: ✅ Working
- MCP registry system: ✅ Dynamic registration working
- **FastMCP Adapter**: ✅ **Pydantic AI ↔ FastMCP bridge working**
- Chat management: ✅ Full CRUD operations
- AI SDK V5 streaming: ✅ Both standard and MCP-enabled chat
- Legacy redirects: ✅ Backward compatibility maintained

### 🔧 MCP System Status

✅ **MCP Registration**: `POST /api/v2/mcp/register` with validation **working**  
✅ **MCP Status**: `GET /api/v2/mcp/status` shows **healthy** with 5 capabilities  
✅ **FastMCP Adapter**: Successfully bridges Pydantic AI ↔ FastMCP server  
✅ **Connection Validation**: Real-time server health monitoring **working**

</details>

<details>
<summary><strong>🏗️ Backend Architecture Overview</strong></summary>

### System Overview

```mermaid
graph LR
    subgraph "Client Layer"
        FE[🌐 Next.js Frontend]
    end

    subgraph "API Layer"
        API[⚡ FastAPI Gateway]
    end

    subgraph "Service Layer"
        SERVICES[🔧 Core Services]
    end

    subgraph "Agent Layer"
        AGENTS[🤖 Agent System]
    end

    subgraph "Integration Layer"
        MCP[🔌 MCP Integration]
    end

    subgraph "Data Layer"
        DATA[💾 PostgreSQL + Models]
    end

    FE --> API
    API --> SERVICES
    SERVICES --> AGENTS
    SERVICES --> MCP
    SERVICES --> DATA

    classDef client fill:#1a237e,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef api fill:#4a148c,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef service fill:#1b5e20,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef agent fill:#e65100,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef integration fill:#880e4f,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef data fill:#2e7d32,stroke:#ffffff,stroke-width:3px,color:#ffffff

    class FE client
    class API api
    class SERVICES service
    class AGENTS agent
    class MCP integration
    class DATA data
```

### Key Architecture Features

- **🔄 Registry-Based MCP Management**: Dynamic server registration without environment variables
- **🏭 Universal Agent Factory**: 90% code reduction through DRY principles
- **📡 AI SDK V5 Streaming**: Real-time chat with tool invocations
- **🤖 Multi-Agent Orchestration**: Specialized agents for different tasks
- **🛡️ Graceful Fallbacks**: System continues working when components are unavailable

</details>

<details>
<summary><strong>⚡ API Gateway & Routing</strong></summary>

```mermaid
graph TB
    subgraph "Incoming Requests"
        CLIENT[🌐 Client Requests]
    end

    subgraph "FastAPI Application"
        APP[📱 FastAPI App]
        CORS[🔒 CORS Middleware]
        LIFESPAN[🔄 Lifespan Manager]
    end

    subgraph "Router System"
        CHAT_R[💬 Chat Router<br/>/api/v2/chat/*]
        AGENT_R[🤖 Agent Router<br/>/api/v2/agents/*]
        MCP_R[🔌 MCP Router<br/>/api/v2/mcp/*]
        TRIAGE_R[🎯 Triage Router<br/>/api/v2/triage/*]
        HEALTH_R[❤️ Health Router<br/>/api/v2/health]
        DEV_R[🛠️ Dev Router<br/>/api/v2/dev/*]
    end

    subgraph "Route Handlers"
        CHAT_H[Chat Handlers]
        AGENT_H[Agent Handlers]
        MCP_H[MCP Handlers]
        TRIAGE_H[Triage Handlers]
        HEALTH_H[Health Handlers]
    end

    CLIENT --> APP
    APP --> CORS
    CORS --> LIFESPAN

    LIFESPAN --> CHAT_R
    LIFESPAN --> AGENT_R
    LIFESPAN --> MCP_R
    LIFESPAN --> TRIAGE_R
    LIFESPAN --> HEALTH_R
    LIFESPAN --> DEV_R

    CHAT_R --> CHAT_H
    AGENT_R --> AGENT_H
    MCP_R --> MCP_H
    TRIAGE_R --> TRIAGE_H
    HEALTH_R --> HEALTH_H

    classDef client fill:#0d47a1,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef app fill:#4a148c,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef router fill:#1b5e20,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef handler fill:#e65100,stroke:#ffffff,stroke-width:3px,color:#ffffff

    class CLIENT client
    class APP,CORS,LIFESPAN app
    class CHAT_R,AGENT_R,MCP_R,TRIAGE_R,HEALTH_R,DEV_R router
    class CHAT_H,AGENT_H,MCP_H,TRIAGE_H,HEALTH_H handler
```

### Router Responsibilities

| Router            | Endpoints   | Purpose                                |
| ----------------- | ----------- | -------------------------------------- |
| **Chat Router**   | `/chat/*`   | Message handling, streaming, summaries |
| **Agent Router**  | `/agents/*` | Agent execution, CRUD, sessions        |
| **MCP Router**    | `/mcp/*`    | Server registration, status, testing   |
| **Triage Router** | `/triage/*` | Task analysis and routing              |
| **Health Router** | `/health`   | System monitoring and diagnostics      |

</details>

<details>
<summary><strong>🔧 Core Services Architecture</strong></summary>

```mermaid
graph TB
    subgraph "Service Layer"
        subgraph "Chat Services"
            CHAT_SVC[💬 Chat Service]
            MSG_SVC[📝 Message Service]
            STREAM_SVC[📡 Streaming Service]
        end

        subgraph "Agent Services"
            FACTORY[🏭 Universal Agent Factory]
            AGENT_MGR[🤖 Agent Manager]
            SESSION_MGR[📋 Session Manager]
        end

        subgraph "MCP Services"
            MCP_STATUS[📊 MCP Status Service]
            MCP_REG[📝 MCP Registry]
            MCP_MONITOR[👁️ MCP Monitor]
        end

        subgraph "System Services"
            HEALTH[❤️ Health Service]
            AI_SVC[🧠 AI Services]
            DB_SVC[💾 Database Service]
        end
    end

    subgraph "External Dependencies"
        OPENAI[🤖 OpenAI API]
        DB[(🗄️ PostgreSQL)]
        MCP_EXT[🔌 External MCP Servers]
    end

    %% Chat service connections
    CHAT_SVC --> MSG_SVC
    CHAT_SVC --> STREAM_SVC
    STREAM_SVC --> AI_SVC

    %% Agent service connections
    FACTORY --> AGENT_MGR
    FACTORY --> SESSION_MGR
    FACTORY --> MCP_REG

    %% MCP service connections
    MCP_STATUS --> MCP_REG
    MCP_REG --> MCP_MONITOR
    MCP_MONITOR --> MCP_EXT

    %% System service connections
    HEALTH --> MCP_STATUS
    HEALTH --> DB_SVC
    AI_SVC --> OPENAI
    DB_SVC --> DB

    classDef chat fill:#0d47a1,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef agent fill:#e65100,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef mcp fill:#880e4f,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef system fill:#1b5e20,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef external fill:#424242,stroke:#ffffff,stroke-width:3px,color:#ffffff

    class CHAT_SVC,MSG_SVC,STREAM_SVC chat
    class FACTORY,AGENT_MGR,SESSION_MGR agent
    class MCP_STATUS,MCP_REG,MCP_MONITOR mcp
    class HEALTH,AI_SVC,DB_SVC system
    class OPENAI,DB,MCP_EXT external
```

### Service Responsibilities

| Service Category    | Components                 | Key Functions                                       |
| ------------------- | -------------------------- | --------------------------------------------------- |
| **Chat Services**   | Chat, Message, Streaming   | Real-time chat, message CRUD, AI SDK V5 streaming   |
| **Agent Services**  | Factory, Manager, Sessions | Agent orchestration, lifecycle management           |
| **MCP Services**    | Status, Registry, Monitor  | Dynamic MCP management, health monitoring           |
| **System Services** | Health, AI, Database       | System monitoring, AI integration, data persistence |

</details>

<details>
<summary><strong>🤖 Agent System Architecture</strong></summary>

```mermaid
graph TB
    subgraph "Agent Factory"
        FACTORY[🏭 Universal Agent Factory]
        FACTORY_CONFIG[⚙️ Factory Configuration]
    end

    subgraph "Agent Types"
        CHAT_AGENT[💬 Chat Assistant<br/>MCP-enabled conversations]
        DOC_AGENT[📚 Documentation Agent<br/>Code documentation generation]
        TRIAGE_AGENT[🎯 Triage Agent<br/>Task complexity analysis]
        SIMPLIFIER[🔧 Simplifier Agent<br/>Code simplification]
        TESTER[🧪 Tester Agent<br/>Test generation]
        SUMMARIZER[📄 Summarizer Agent<br/>Content summarization]
    end

    subgraph "Agent Capabilities"
        MCP_TOOLS[🔌 MCP Tools]
        CODE_TOOLS[💻 Code Tools]
        PYTHON_EXEC[🐍 Python Execution]
        STREAMING[📡 Streaming Support]
    end

    subgraph "Agent Management"
        SESSIONS[📋 Session Manager]
        TASKS[📝 Task Tracker]
        ERRORS[⚠️ Error Handler]
        BUDGET[💰 Tool Budget Manager]
    end

    FACTORY --> FACTORY_CONFIG
    FACTORY_CONFIG --> CHAT_AGENT
    FACTORY_CONFIG --> DOC_AGENT
    FACTORY_CONFIG --> TRIAGE_AGENT
    FACTORY_CONFIG --> SIMPLIFIER
    FACTORY_CONFIG --> TESTER
    FACTORY_CONFIG --> SUMMARIZER

    CHAT_AGENT --> MCP_TOOLS
    DOC_AGENT --> CODE_TOOLS
    TRIAGE_AGENT --> PYTHON_EXEC
    CHAT_AGENT --> STREAMING
    DOC_AGENT --> STREAMING

    FACTORY --> SESSIONS
    SESSIONS --> TASKS
    TASKS --> ERRORS
    SESSIONS --> BUDGET

    classDef factory fill:#e65100,stroke:#ffffff,stroke-width:4px,color:#ffffff
    classDef agent fill:#1b5e20,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef capability fill:#0d47a1,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef management fill:#880e4f,stroke:#ffffff,stroke-width:3px,color:#ffffff

    class FACTORY,FACTORY_CONFIG factory
    class CHAT_AGENT,DOC_AGENT,TRIAGE_AGENT,SIMPLIFIER,TESTER,SUMMARIZER agent
    class MCP_TOOLS,CODE_TOOLS,PYTHON_EXEC,STREAMING capability
    class SESSIONS,TASKS,ERRORS,BUDGET management
```

### Agent Specializations

| Agent Type         | Purpose                   | Key Features                           |
| ------------------ | ------------------------- | -------------------------------------- |
| **Chat Assistant** | MCP-enabled conversations | Code awareness, tool access, streaming |
| **Documentation**  | Generate code docs        | Mermaid diagrams, API documentation    |
| **Triage**         | Task complexity analysis  | Smart routing, resource optimization   |
| **Simplifier**     | Code simplification       | Refactoring, optimization suggestions  |
| **Tester**         | Test generation           | Unit tests, integration tests          |
| **Summarizer**     | Content summarization     | Chat summaries, code explanations      |

</details>

<details>
<summary><strong>🔌 MCP Integration System</strong></summary>

```mermaid
graph TB
    subgraph "MCP Management Layer"
        MCP_STATUS[📊 MCP Status Service]
        MCP_REG[📝 MCP Registry]
        MCP_MONITOR[👁️ MCP Monitor]
    end

    subgraph "MCP Control API"
        REG_EP[📝 /mcp/register]
        DEREG_EP[❌ /mcp/deregister]
        STATUS_EP[📊 /mcp/status]
        TEST_EP[🧪 /mcp/test-connection]
    end

    subgraph "MCP Server Registry"
        ACTIVE_SERVER[🟢 Active Server]
        SERVER_URL[🔗 Server URL]
        SERVER_STATUS[📈 Server Health]
        CAPABILITIES[⚡ Capabilities List]
    end

    subgraph "External MCP Servers"
        CODE_INDEX[🗂️ Code Indexing Service<br/>localhost:8009]
        CUSTOM_MCP[🔧 Custom MCP Server<br/>Dynamic Registration]
        FUTURE_MCP[➕ Future MCP Servers<br/>Extensible]
    end

    subgraph "MCP Tools & Capabilities"
        SEARCH_CODE[🔍 search_code]
        FIND_ENTITIES[🎯 find_entities]
        QA_CODEBASE[❓ qa_codebase]
        GET_RELATIONS[🔗 get_entity_relationships]
        GEN_DIAGRAM[📊 generate_diagram]
    end

    %% Control flow
    REG_EP --> MCP_REG
    DEREG_EP --> MCP_REG
    STATUS_EP --> MCP_STATUS
    TEST_EP --> MCP_STATUS

    %% Registry management
    MCP_REG --> ACTIVE_SERVER
    MCP_REG --> SERVER_URL
    MCP_STATUS --> SERVER_STATUS
    MCP_STATUS --> CAPABILITIES

    %% Server connections
    ACTIVE_SERVER --> CODE_INDEX
    ACTIVE_SERVER --> CUSTOM_MCP
    SERVER_URL --> FUTURE_MCP

    %% Capabilities mapping
    CODE_INDEX --> SEARCH_CODE
    CODE_INDEX --> FIND_ENTITIES
    CODE_INDEX --> QA_CODEBASE
    CODE_INDEX --> GET_RELATIONS
    CODE_INDEX --> GEN_DIAGRAM

    %% Monitoring
    MCP_MONITOR --> MCP_STATUS
    MCP_MONITOR --> SERVER_STATUS

    classDef management fill:#880e4f,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef api fill:#0d47a1,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef registry fill:#e65100,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef server fill:#4a148c,stroke:#ffffff,stroke-width:3px,color:#ffffff
    classDef tools fill:#1b5e20,stroke:#ffffff,stroke-width:3px,color:#ffffff

    class MCP_STATUS,MCP_REG,MCP_MONITOR management
    class REG_EP,DEREG_EP,STATUS_EP,TEST_EP api
    class ACTIVE_SERVER,SERVER_URL,SERVER_STATUS,CAPABILITIES registry
    class CODE_INDEX,CUSTOM_MCP,FUTURE_MCP server
    class SEARCH_CODE,FIND_ENTITIES,QA_CODEBASE,GET_RELATIONS,GEN_DIAGRAM tools
```

### MCP System Features

| Component             | Function                  | Benefits                                |
| --------------------- | ------------------------- | --------------------------------------- |
| **Registry System**   | Dynamic server management | No environment variables, hot-swappable |
| **Status Monitoring** | Real-time health checks   | Graceful fallbacks, error recovery      |
| **Tool Integration**  | Code-aware capabilities   | Search, analysis, diagram generation    |
| **API Control**       | RESTful server management | Easy integration, validation            |

### MCP Workflow

1. **Register Server**: `POST /api/v2/mcp/register` with server URL
2. **Validate Connection**: Automatic connection testing and capability detection
3. **Monitor Health**: Continuous monitoring with exponential backoff on failures
4. **Use Tools**: Agents automatically access MCP tools when available
5. **Graceful Fallback**: System continues working when MCP unavailable

</details>

<details>
<summary><strong>🚀 Key API Endpoints</strong></summary>

### Essential Endpoints for Frontend Integration

| Category        | Endpoint                     | Method   | Purpose                 | Status    |
| --------------- | ---------------------------- | -------- | ----------------------- | --------- |
| **Health**      | `/api/v2/health`             | GET      | System health check     | ✅ Tested |
| **MCP Status**  | `/api/v2/mcp/status`         | GET      | MCP server availability | ✅ Tested |
| **MCP Control** | `/api/v2/mcp/register`       | POST     | Register MCP server     | ✅ Tested |
| **Chat**        | `/api/v2/chat/create`        | POST     | Create new chat         | ✅ Tested |
| **Chat**        | `/api/v2/chat/{id}`          | POST     | Standard AI chat        | ✅ Tested |
| **MCP Chat**    | `/api/v2/chat/{id}/ai`       | POST     | Code-aware AI chat      | ✅ Tested |
| **Messages**    | `/api/v2/chat/{id}/messages` | GET/POST | Message CRUD            | ✅ Tested |

### Quick API Test Examples

```bash
# Health check
curl http://localhost/api/v2/health

# Check MCP status
curl http://localhost/api/v2/mcp/status

# Create a chat
CHAT_ID=$(curl -s -X POST http://localhost/api/v2/chat/create | jq -r '.id')

# Send a message (standard chat)
curl -X POST "http://localhost/api/v2/chat/$CHAT_ID" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!"}],"model":"gpt-4o"}'

# Send a message (MCP-enabled chat)
curl -X POST "http://localhost/api/v2/chat/$CHAT_ID/ai" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How does authentication work?"}],"model":"gpt-4o"}'
```

### Response Headers (MCP Chat)

MCP-enabled chat includes helpful headers:

- `X-MCP-Enabled: true|false` - MCP availability
- `X-MCP-Status: healthy|degraded|failed|disabled` - Server status
- `X-MCP-Capabilities: search_code,find_entities,...` - Available tools
- `X-Chat-Type: pydantic-ai` - Chat type identifier

### ⚠️ Frontend Integration Warning

**IMPORTANT**: There is **NO** `/api/v2/mcp/servers` endpoint. If your frontend is trying to access this endpoint, it will return `404 Not Found`. Use the correct endpoints:

```javascript
// ❌ WRONG - These endpoints don't exist
GET / api / v2 / mcp / servers; // 404 Not Found
POST / api / v2 / mcp / servers; // 404 Not Found

// ✅ CORRECT - Use these endpoints instead
GET / api / v2 / mcp / status; // Check MCP availability
GET / api / v2 / mcp / registry / status; // Check registered server
POST / api / v2 / mcp / register; // Register MCP server
POST / api / v2 / mcp / deregister; // Remove MCP server
POST / api / v2 / mcp / test - connection; // Test connection
```

</details>

<details>
<summary><strong>📚 API v2 Endpoints</strong></summary>

> All routes are served under `/api/v2/*` prefix

## Health & System

| Method | Endpoint             | Description                        | Response                                    |
| ------ | -------------------- | ---------------------------------- | ------------------------------------------- |
| `GET`  | `/api/v2/health`     | Unified system health check        | Health status with component details        |
| `GET`  | `/api/v2/mcp/status` | MCP server status and capabilities | MCP status, availability, and error details |

## Chat Management

| Method   | Endpoint                       | Description              | Features                 |
| -------- | ------------------------------ | ------------------------ | ------------------------ |
| `POST`   | `/api/v2/chat/create`          | Create new chat session  | Returns chat ID          |
| `GET`    | `/api/v2/chats`                | List all chats           | Ordered by last updated  |
| `DELETE` | `/api/v2/chat/{chat_id}`       | Delete chat and messages | Cascading delete         |
| `PATCH`  | `/api/v2/chat/{chat_id}/title` | Update chat title        | Manual or auto-generated |

## Chat Interactions

| Method | Endpoint                                          | Description              | Features                        |
| ------ | ------------------------------------------------- | ------------------------ | ------------------------------- |
| `POST` | `/api/v2/chat/{chat_id}`                          | Standard chat endpoint   | AI SDK V5 streaming, tool calls |
| `POST` | `/api/v2/chat/{chat_id}/ai`                       | **MCP-enabled chat**     | Code-aware responses, MCP tools |
| `POST` | `/api/v2/chat/{chat_id}/generate-title`           | Generate chat title      | From first user message         |
| `POST` | `/api/v2/chat/{chat_id}/generate-summary`         | Generate full summary    | Complete conversation analysis  |
| `POST` | `/api/v2/chat/{chat_id}/generate-rolling-summary` | Generate rolling summary | Skip first N interactions       |

## Message Operations

| Method   | Endpoint                                             | Description             | Features                    |
| -------- | ---------------------------------------------------- | ----------------------- | --------------------------- |
| `GET`    | `/api/v2/chat/{chat_id}/messages`                    | Get chat messages       | Excludes agent messages     |
| `POST`   | `/api/v2/chat/{chat_id}/messages`                    | Create new message      | User/assistant messages     |
| `PATCH`  | `/api/v2/chat/{chat_id}/messages/{message_id}`       | Edit message content    | Removes subsequent messages |
| `DELETE` | `/api/v2/chat/{chat_id}/messages/{message_id}`       | Delete specific message | Single message removal      |
| `PATCH`  | `/api/v2/chat/{chat_id}/messages/{message_id}/model` | Update message model    | Change AI model used        |

## Agent Messages

| Method | Endpoint                                | Description          | Features                            |
| ------ | --------------------------------------- | -------------------- | ----------------------------------- |
| `GET`  | `/api/v2/chat/{chat_id}/agent/messages` | Get agent messages   | Filtered by agent, repository, type |
| `POST` | `/api/v2/chat/{chat_id}/agent/messages` | Create agent message | Pipeline tracking, iterations       |

## Agent Execution

| Method | Endpoint                           | Description                   | Features                   |
| ------ | ---------------------------------- | ----------------------------- | -------------------------- |
| `POST` | `/api/v2/agents/execute`           | Execute agent task            | Synchronous execution      |
| `POST` | `/api/v2/agents/execute/streaming` | **Streaming agent execution** | Real-time progress updates |
| `POST` | `/api/v2/agents/execute/single`    | Single-step execution         | One iteration only         |
| `GET`  | `/api/v2/agents/types`             | List available agent types    | Agent capabilities         |

## Agent Session Management

| Method   | Endpoint                              | Description         | Features                  |
| -------- | ------------------------------------- | ------------------- | ------------------------- |
| `GET`    | `/api/v2/agents/session/{session_id}` | Get session details | Session state and history |
| `DELETE` | `/api/v2/agents/session/{session_id}` | Delete session      | Clean up resources        |
| `GET`    | `/api/v2/agents/task/{task_id}`       | Get task status     | Task progress and results |
| `POST`   | `/api/v2/agents/task/{task_id}/retry` | Retry failed task   | Error recovery            |

## Agent CRUD Operations

| Method   | Endpoint                    | Description       | Features                    |
| -------- | --------------------------- | ----------------- | --------------------------- |
| `POST`   | `/api/v2/agents`            | Create new agent  | Custom agent configuration  |
| `GET`    | `/api/v2/agents`            | List all agents   | Active agents only          |
| `GET`    | `/api/v2/agents/{agent_id}` | Get agent details | Configuration and status    |
| `PATCH`  | `/api/v2/agents/{agent_id}` | Update agent      | Modify configuration        |
| `DELETE` | `/api/v2/agents/{agent_id}` | Delete agent      | Soft delete (mark inactive) |

## Agent Error Management

| Method | Endpoint                           | Description          | Features                 |
| ------ | ---------------------------------- | -------------------- | ------------------------ |
| `GET`  | `/api/v2/agents/errors/statistics` | Get error statistics | Error rates and patterns |
| `POST` | `/api/v2/agents/errors/reset`      | Reset error counters | Clear error history      |

## Triage System

| Method | Endpoint                           | Description                    | Features                 |
| ------ | ---------------------------------- | ------------------------------ | ------------------------ |
| `POST` | `/api/v2/triage/analyze`           | Analyze task complexity        | Task categorization      |
| `POST` | `/api/v2/triage/execute`           | Execute triaged task           | Optimized execution path |
| `POST` | `/api/v2/triage/execute/streaming` | **Streaming triage execution** | Real-time triage updates |
| `GET`  | `/api/v2/triage/stats`             | Get triage statistics          | Performance metrics      |

## MCP Control (Updated)

| Method | Endpoint                      | Description               | Features                     |
| ------ | ----------------------------- | ------------------------- | ---------------------------- |
| `POST` | `/api/v2/mcp/register`        | **Register MCP server**   | Dynamic server registration  |
| `POST` | `/api/v2/mcp/deregister`      | **Deregister MCP server** | Remove active server         |
| `GET`  | `/api/v2/mcp/registry/status` | **Get registry status**   | Active server information    |
| `POST` | `/api/v2/mcp/test-connection` | **Test MCP connection**   | Validate server connectivity |

> **New**: MCP servers are now managed via registry API instead of environment variables

## Development Tools

| Method | Endpoint                     | Description             | Features                         |
| ------ | ---------------------------- | ----------------------- | -------------------------------- |
| `POST` | `/api/v2/dev/streaming/mock` | Mock streaming response | Testing streaming endpoints      |
| `GET`  | `/api/v2/dev/streaming/test` | Test streaming setup    | Validate streaming configuration |

## System Utilities

| Method | Endpoint                      | Description              | Features                          |
| ------ | ----------------------------- | ------------------------ | --------------------------------- |
| `GET`  | `/api/v2/system/prompts/docs` | Get documentation prompt | System prompt for docs generation |

</details>

## 🧪 Testing & Validation

### Comprehensive Backend Testing

Our backend includes a comprehensive test suite that validates all functionality:

```bash
# Run all backend tests
uv run python test_backend_changes.py
```

### Test Coverage

| Test Category          | Tests | Status | Coverage                                 |
| ---------------------- | ----- | ------ | ---------------------------------------- |
| **Health & System**    | 2/2   | ✅     | Health checks, legacy redirects          |
| **MCP Registry**       | 4/4   | ✅     | Registration, status, connection testing |
| **Chat Management**    | 2/2   | ✅     | Create, list, CRUD operations            |
| **Chat Interactions**  | 2/2   | ✅     | Standard & MCP-enabled streaming         |
| **Message Operations** | 2/2   | ✅     | Get, create, edit messages               |
| **Legacy Redirects**   | 3/3   | ✅     | Backward compatibility                   |

**Total: 15/15 tests passing (100% success rate)**

### Key Validations

- ✅ **MCP Registry System**: Dynamic server registration without environment variables
- ✅ **AI SDK V5 Streaming**: Both standard and MCP-enabled chat endpoints
- ✅ **Graceful Fallbacks**: System works with or without MCP servers
- ✅ **Legacy Compatibility**: All old endpoints redirect properly
- ✅ **Error Handling**: Proper HTTP status codes and error messages
- ✅ **Performance**: Response times under acceptable thresholds

### Docker Integration

```bash
# Rebuild and test after changes
docker compose down --volumes
docker compose build --no-cache
docker compose up -d
uv run python test_backend_changes.py
```

## Learn More

- Backend docs: `docs/backend/README.md`
- API analysis: `docs/api/endpoints-analysis.md`
