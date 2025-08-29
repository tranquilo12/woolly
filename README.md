# Woolly

FastAPI + Next.js platform for AI-powered, code-aware assistance with MCP integration, multi-agent orchestration, and AI SDK V5 streaming.

## Backend Quickstart

1. Install Python deps

```bash
pip install -r api/requirements.txt
```

2. Set environment

```env
DATABASE_URL=postgresql://user:password@localhost/woolly
OPENAI_API_KEY=your-openai-api-key
MCP_SERVER_URL=http://localhost:8009/sse/
```

3. Migrate and run

```bash
alembic upgrade head
uvicorn api.index:app --host 0.0.0.0 --port 8000 --reload
```

## API v2 Endpoints

Primary routes are served under `/api/v2/*`.

### Health & System

- GET `/api/v2/health` – unified system health
- GET `/api/v2/mcp/status` – MCP server status

### Chat

- POST `/api/v2/chat/{chat_id}` – standard chat (AI SDK V5 streaming)
- POST `/api/v2/chat/{chat_id}/ai` – MCP-enabled chat
- POST `/api/v2/chat/{chat_id}/generate-title`
- POST `/api/v2/chat/{chat_id}/generate-summary`
- POST `/api/v2/chat/{chat_id}/generate-rolling-summary`

### Messages

- GET `/api/v2/chat/{chat_id}/messages`
- POST `/api/v2/chat/{chat_id}/messages`
- PATCH `/api/v2/chat/{chat_id}/messages/{message_id}`
- DELETE `/api/v2/chat/{chat_id}/messages/{message_id}`
- PATCH `/api/v2/chat/{chat_id}/messages/{message_id}/model`

### Agent Messages

- GET `/api/v2/chat/{chat_id}/agent/messages`
- POST `/api/v2/chat/{chat_id}/agent/messages`

### Agents

- POST `/api/v2/agents/execute`
- POST `/api/v2/agents/execute/streaming`
- POST `/api/v2/agents/execute/single`
- GET `/api/v2/agents/types`
- GET `/api/v2/agents/session/{session_id}`
- DELETE `/api/v2/agents/session/{session_id}`
- GET `/api/v2/agents/task/{task_id}`
- POST `/api/v2/agents/task/{task_id}/retry`
- GET `/api/v2/agents/errors/statistics`
- POST `/api/v2/agents/errors/reset`

### Agent CRUD

- POST `/api/v2/agents`
- GET `/api/v2/agents`
- GET `/api/v2/agents/{agent_id}`
- PATCH `/api/v2/agents/{agent_id}`
- DELETE `/api/v2/agents/{agent_id}`

### Triage

- POST `/api/v2/triage/analyze`
- POST `/api/v2/triage/execute`
- POST `/api/v2/triage/execute/streaming`
- GET `/api/v2/triage/stats`

### MCP Control

- POST `/api/v2/mcp/register`
- POST `/api/v2/mcp/deregister`
- GET `/api/v2/mcp/registry/status`
- POST `/api/v2/mcp/test-connection`

### Dev Tools

- POST `/api/v2/dev/streaming/mock`
- GET `/api/v2/dev/streaming/test`

### System

- GET `/api/v2/system/prompts/docs`

## Learn More

- Backend docs: `docs/backend/README.md`
- API analysis: `docs/api/endpoints-analysis.md`
