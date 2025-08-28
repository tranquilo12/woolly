# MCP Chat Integration - Surgical Implementation Plan

## 🎯 Strategy: Hybrid Chat Agent Approach

**Goal**: Add MCP access to existing chat endpoints with minimal disruption to current architecture.

**Approach**: Create a "Chat Agent" that bridges the existing chat system with the Universal Agent Factory's MCP capabilities.

## 🔍 Current State Analysis

### Chat Endpoint Flow

```
POST /api/chat/{chat_id}
├── chat() function
├── convert_to_openai_messages()
├── stream_text()
├── do_stream()
└── OpenAI API (only execute_python_code tool)
```

### Agent Endpoint Flow (with MCP)

```
POST /api/v1/agents/execute/single
├── Universal Agent Factory
├── create_agent_with_context()
├── Pydantic AI Agent + MCP servers
└── async with agent.run_mcp_servers():
```

## 🚀 Implementation Plan

### Phase 1: Create Chat Agent Type (30 minutes)

**File**: `api/agents/universal.py`

Add new agent type to existing enum:

```python
class AgentType(str, Enum):
    SIMPLIFIER = "simplifier"
    TESTER = "tester"
    CONVO_STARTER = "convo_starter"
    SUMMARIZER = "summarizer"
    DOCUMENTATION = "documentation"
    CHAT_ASSISTANT = "chat_assistant"  # NEW
```

Add chat specialization to existing factory:

```python
self.specializations = {
    # ... existing specializations ...
    AgentType.CHAT_ASSISTANT: """
    You are a helpful AI assistant with access to codebase analysis tools.

    You can help users with:
    - General questions and conversations
    - Code analysis and search using MCP tools
    - Repository exploration and understanding
    - Technical discussions with code context

    Available MCP Tools:
    - search_code: Search for code patterns and implementations
    - find_entities: Discover functions, classes, files
    - get_entity_relationships: Map code dependencies
    - qa_codebase: Get comprehensive codebase insights
    - generate_diagram: Create visual representations

    Use these tools when users ask about code, want to explore the repository,
    or need technical context for their questions.
    """,
}
```

### Phase 2: Create MCP-Enabled Chat Function (45 minutes)

**File**: `api/utils/mcp_chat.py` (NEW)

```python
"""
MCP-enabled chat utilities that bridge existing chat system with Universal Agent Factory
"""
import asyncio
from typing import List, AsyncGenerator, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from .models import build_text_stream, build_end_of_stream_message
from ..agents.universal import get_universal_factory, AgentType, UniversalDependencies
from ..utils.prompt import ClientMessageWithTools

async def stream_mcp_chat(
    messages: List[ClientMessageWithTools],
    model: str = "gpt-4o",
    repository_name: str = "woolly",
    chat_id: Optional[UUID] = None,
    db: Optional[Session] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream chat responses using MCP-enabled chat agent

    This function bridges the existing chat system with the Universal Agent Factory
    to provide MCP tool access while maintaining chat conversation flow.
    """
    try:
        # Get the universal factory
        factory = get_universal_factory()

        # Create chat agent with MCP integration
        agent = factory.create_agent_with_context(AgentType.CHAT_ASSISTANT)

        # Convert chat messages to user query
        # Take the last user message as the primary query
        user_messages = [msg for msg in messages if msg.role == "user"]
        if not user_messages:
            yield build_text_stream("No user message found.")
            return

        latest_query = user_messages[-1].content

        # Build conversation context from previous messages
        conversation_context = []
        for msg in messages[:-1]:  # All except the latest
            conversation_context.append({
                "role": msg.role,
                "content": msg.content,
                "timestamp": getattr(msg, 'created_at', None)
            })

        # Create dependencies
        deps = UniversalDependencies(
            repository_name=repository_name,
            user_context={
                "chat_id": str(chat_id) if chat_id else None,
                "conversation_history": conversation_context,
                "model": model
            },
            conversation_history=conversation_context
        )

        # Stream the agent response
        async with agent.run_mcp_servers():
            async for chunk in factory.execute_agent_streaming(
                agent_type=AgentType.CHAT_ASSISTANT,
                repository_name=repository_name,
                user_query=latest_query,
                context=deps.user_context
            ):
                yield chunk

    except Exception as e:
        yield build_text_stream(f"Error in MCP chat: {str(e)}")
        yield build_end_of_stream_message(
            finish_reason="error",
            prompt_tokens=0,
            completion_tokens=0,
            is_continued=False
        )

def should_use_mcp_chat(messages: List[ClientMessageWithTools]) -> bool:
    """
    Determine if the chat should use MCP tools based on message content

    Returns True if:
    - User mentions code, repository, files, or technical terms
    - User asks questions that would benefit from codebase context
    """
    if not messages:
        return False

    # Get the latest user message
    user_messages = [msg for msg in messages if msg.role == "user"]
    if not user_messages:
        return False

    latest_message = user_messages[-1].content.lower()

    # Keywords that suggest MCP tools would be helpful
    mcp_keywords = [
        'code', 'function', 'class', 'file', 'repository', 'repo',
        'implementation', 'how does', 'where is', 'find', 'search',
        'api', 'endpoint', 'database', 'model', 'component',
        'architecture', 'structure', 'pattern', 'design',
        'bug', 'error', 'issue', 'problem', 'fix',
        'test', 'testing', 'coverage', 'unit test',
        'documentation', 'docs', 'readme', 'guide'
    ]

    return any(keyword in latest_message for keyword in mcp_keywords)
```

### Phase 3: Modify Chat Endpoint (15 minutes)

**File**: `api/index.py`

Add MCP option to existing chat endpoint:

```python
# Add import at top
from .utils.mcp_chat import stream_mcp_chat, should_use_mcp_chat

# Modify existing chat function
@app.post("/api/chat/{chat_id}")
async def chat(
    chat_id: uuid.UUID,
    request: RequestFromFrontend,
    db: Session = Depends(get_db),
    protocol: str = Query("data"),
    enable_mcp: bool = Query(False, description="Enable MCP tools for code-aware chat"),
    repository_name: str = Query("woolly", description="Repository name for MCP context"),
):
    try:
        # ... existing chat setup code ...

        messages = request.messages
        if not messages:
            raise HTTPException(status_code=422, detail="No messages provided")

        model = request.model or messages[-1].model or "gpt-4o"

        # ... existing message creation code ...

        db.commit()

        # NEW: Decide whether to use MCP or traditional chat
        use_mcp = enable_mcp or should_use_mcp_chat(messages)

        if use_mcp:
            # Use MCP-enabled chat
            return StreamingResponse(
                stream_mcp_chat(
                    messages=messages,
                    model=model,
                    repository_name=repository_name,
                    chat_id=chat_id,
                    db=db
                ),
                media_type="text/plain; charset=utf-8",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Transfer-Encoding": "chunked",
                    "Content-Encoding": "none",
                },
            )
        else:
            # Use existing traditional chat
            openai_messages = convert_to_openai_messages(messages)
            return StreamingResponse(
                stream_text(
                    openai_messages,
                    protocol,
                    model=model,
                    db=db,
                    message_id=assistant_message.id,
                ),
                media_type="text/plain; charset=utf-8",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Transfer-Encoding": "chunked",
                    "Content-Encoding": "none",
                },
            )

    except Exception as e:
        # ... existing error handling ...
```

### Phase 4: Add Explicit MCP Chat Endpoint (10 minutes)

**File**: `api/index.py`

Add new explicit MCP endpoint:

```python
@app.post("/api/chat/{chat_id}/mcp")
async def chat_with_mcp(
    chat_id: uuid.UUID,
    request: RequestFromFrontend,
    db: Session = Depends(get_db),
    repository_name: str = Query("woolly", description="Repository name for MCP context"),
):
    """
    Explicit MCP-enabled chat endpoint

    This endpoint always uses MCP tools for code-aware conversations.
    """
    try:
        # ... same setup as regular chat ...

        return StreamingResponse(
            stream_mcp_chat(
                messages=request.messages,
                model=request.model or "gpt-4o",
                repository_name=repository_name,
                chat_id=chat_id,
                db=db
            ),
            media_type="text/plain; charset=utf-8",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Transfer-Encoding": "chunked",
                "Content-Encoding": "none",
            },
        )
    except Exception as e:
        # ... error handling ...
```

## 🎯 Benefits of This Approach

### ✅ Advantages

1. **Minimal Disruption**: Existing chat endpoints continue to work exactly as before
2. **Gradual Migration**: Can enable MCP selectively via query parameter or automatic detection
3. **Reuses Existing Infrastructure**: Leverages Universal Agent Factory and MCP integration
4. **Backward Compatible**: No breaking changes to frontend
5. **Fast Implementation**: ~90 minutes total development time

### 🔧 Implementation Order

1. **Phase 1** (30 min): Add CHAT_ASSISTANT agent type
2. **Phase 2** (45 min): Create MCP chat utility functions
3. **Phase 3** (15 min): Modify existing chat endpoint with MCP option
4. **Phase 4** (10 min): Add explicit MCP endpoint

### 🧪 Testing Strategy

1. Test existing chat functionality (should be unchanged)
2. Test `enable_mcp=true` parameter
3. Test automatic MCP detection with code-related queries
4. Test explicit `/api/chat/{chat_id}/mcp` endpoint
5. Verify MCP tools work in chat context

### 📈 Future Enhancements

- Add MCP tool selection in chat UI
- Repository switching in chat context
- Chat-specific MCP tool configurations
- Enhanced conversation context for MCP tools

## 🚨 Rollback Plan

If issues arise, simply:

1. Set `enable_mcp=false` by default
2. Remove MCP detection logic
3. Chat system reverts to original behavior

This approach provides **maximum safety** with **minimum risk** while delivering the requested MCP integration to chat endpoints.
