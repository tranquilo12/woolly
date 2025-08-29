# Pydantic AI Chat Migration - Direct Replacement Strategy

## 🎯 Migration Assessment: MODERATE Effort, MASSIVE Benefits

**Complexity**: 🟡 Moderate (2-3 hours)  
**Risk**: 🟢 Low (can rollback easily)  
**Benefits**: 🚀 Huge (MCP access + code reduction)

## 📊 Current vs Pydantic AI

### Current OpenAI Chat System

```python
# 150+ lines of complex streaming logic
def stream_text(messages, model, db, message_id):
    # Manual OpenAI API calls
    # Manual tool call parsing
    # Manual V5 format generation
    # Manual error handling
    # Manual conversation management
```

### Pydantic AI Chat System

```python
# ~30 lines of simple agent streaming
async def stream_pydantic_chat(messages, model, repository_name):
    agent = create_chat_agent()  # With MCP access
    async with agent.run_mcp_servers():
        async for chunk in agent.run_stream(query, deps=deps):
            # Automatic MCP tool access
            # Automatic V5 format generation
            # Built-in error handling
            # Built-in conversation context
```

## 🔍 Key Discovery: V5 Format Already Works

**Critical Finding**: The Universal Agent Factory already produces perfect AI SDK V5 format:

```python
# From api/agents/universal.py line 1204-1228
def _format_stream_event(self, event_type: str, data: Dict[str, Any]) -> str:
    """Format streaming events for AI SDK V5 compatibility."""
    from api.utils.models import (
        build_text_stream,           # 0:"text"
        build_tool_call_partial,     # 9:{...}
        build_tool_call_result,      # a:{...}
        build_end_of_stream_message, # e:{...}
    )

    if event_type == "text":
        return build_text_stream(data["content"])
    elif event_type == "toolCall":
        return build_tool_call_partial(...)
    # ... etc
```

## 🚀 Migration Strategy: Direct Replacement

### Phase 1: Create Chat Agent (30 minutes)

**File**: `api/agents/universal.py`

Add chat agent type (already planned):

```python
class AgentType(str, Enum):
    # ... existing types ...
    CHAT_ASSISTANT = "chat_assistant"

# Add to specializations
AgentType.CHAT_ASSISTANT: """
You are a helpful AI assistant with full codebase access via MCP tools.

You excel at:
- Natural conversation with code context
- Answering questions using repository knowledge
- Helping with development tasks
- Providing code examples and explanations

Available MCP Tools:
- search_code: Find code patterns and implementations
- find_entities: Discover functions, classes, files
- get_entity_relationships: Map code dependencies
- qa_codebase: Get comprehensive insights
- generate_diagram: Create visual representations

Use these tools naturally when users ask about code, want to explore
the repository, or need technical context. Maintain conversational
flow while providing accurate, contextual responses.
""",
```

### Phase 2: Create Pydantic AI Chat Function (45 minutes)

**File**: `api/utils/pydantic_chat.py` (NEW)

```python
"""
Pydantic AI-powered chat with MCP integration and AI SDK V5 streaming
"""
import asyncio
from typing import List, AsyncGenerator, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session

from ..agents.universal import get_universal_factory, AgentType, UniversalDependencies
from ..utils.prompt import ClientMessageWithTools
from ..utils.models import build_end_of_stream_message, build_text_stream

async def stream_pydantic_chat(
    messages: List[ClientMessageWithTools],
    model: str = "gpt-4o",
    repository_name: str = "woolly",
    chat_id: Optional[UUID] = None,
    db: Optional[Session] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream chat responses using Pydantic AI with MCP integration

    This replaces the complex OpenAI streaming logic with simple
    Pydantic AI agent streaming that produces the same AI SDK V5 format.
    """
    try:
        # Get universal factory (already has MCP integration)
        factory = get_universal_factory()

        # Extract user query from messages
        user_messages = [msg for msg in messages if msg.role == "user"]
        if not user_messages:
            yield build_text_stream("No user message found.")
            return

        latest_query = user_messages[-1].content

        # Build conversation history for context
        conversation_history = []
        for msg in messages[:-1]:  # All except latest
            conversation_history.append({
                "role": msg.role,
                "content": msg.content,
                "timestamp": getattr(msg, 'created_at', None)
            })

        # Create dependencies with chat context
        deps = UniversalDependencies(
            repository_name=repository_name,
            user_context={
                "chat_id": str(chat_id) if chat_id else None,
                "conversation_history": conversation_history,
                "model": model,
                "chat_mode": True  # Flag for chat-specific behavior
            },
            conversation_history=conversation_history
        )

        # Stream using existing Universal Agent Factory
        # This automatically handles MCP tools and V5 formatting
        async for chunk in factory.execute_agent_streaming(
            agent_type=AgentType.CHAT_ASSISTANT,
            repository_name=repository_name,
            user_query=latest_query,
            context=deps.user_context
        ):
            yield chunk

    except Exception as e:
        yield build_text_stream(f"Chat error: {str(e)}")
        yield build_end_of_stream_message(
            finish_reason="error",
            prompt_tokens=0,
            completion_tokens=0,
            is_continued=False
        )

def convert_messages_to_pydantic_context(
    messages: List[ClientMessageWithTools]
) -> Dict[str, Any]:
    """Convert chat messages to Pydantic AI context format"""
    return {
        "messages": [
            {
                "role": msg.role,
                "content": msg.content,
                "id": getattr(msg, 'id', None),
                "model": getattr(msg, 'model', None),
                "created_at": getattr(msg, 'created_at', None)
            }
            for msg in messages
        ],
        "message_count": len(messages),
        "has_attachments": any(
            getattr(msg, 'experimental_attachments', None) for msg in messages
        )
    }
```

### Phase 3: Replace Chat Endpoint (30 minutes)

**File**: `api/index.py`

Replace the existing chat function:

```python
# Add import
from .utils.pydantic_chat import stream_pydantic_chat

@app.post("/api/chat/{chat_id}")
async def chat(
    chat_id: uuid.UUID,
    request: RequestFromFrontend,
    db: Session = Depends(get_db),
    protocol: str = Query("data"),
    repository_name: str = Query("woolly", description="Repository for MCP context"),
    use_legacy: bool = Query(False, description="Use legacy OpenAI streaming"),
):
    """
    Chat endpoint with Pydantic AI + MCP integration

    Now uses Pydantic AI by default for MCP tool access and simpler code.
    Set use_legacy=true to use the old OpenAI streaming approach.
    """
    try:
        # ... existing chat setup code (unchanged) ...

        messages = request.messages
        if not messages:
            raise HTTPException(status_code=422, detail="No messages provided")

        model = request.model or messages[-1].model or "gpt-4o"

        # ... existing message creation code (unchanged) ...

        db.commit()

        if use_legacy:
            # Legacy OpenAI streaming (keep as fallback)
            openai_messages = convert_to_openai_messages(messages)
            return StreamingResponse(
                stream_text(
                    openai_messages, protocol, model=model,
                    db=db, message_id=assistant_message.id,
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
            # NEW: Pydantic AI streaming with MCP access
            return StreamingResponse(
                stream_pydantic_chat(
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

    except Exception as e:
        # ... existing error handling ...
```

### Phase 4: Update Legacy Endpoint (15 minutes)

**File**: `api/index.py`

Update the legacy chat endpoint:

```python
@app.post("/api/chat")
async def handle_chat_legacy(
    request: RequestFromFrontend,
    protocol: str = Query("data"),
    repository_name: str = Query("woolly"),
):
    """Legacy endpoint - now uses Pydantic AI by default"""
    messages = request.messages

    if not messages:
        # ... existing validation ...

    # Use Pydantic AI streaming by default
    return StreamingResponse(
        stream_pydantic_chat(
            messages=messages,
            model=request.model or "gpt-4o",
            repository_name=repository_name
        ),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Transfer-Encoding": "chunked",
            "Content-Encoding": "none",
        },
    )
```

## 🎯 Benefits of Direct Migration

### ✅ **Immediate Gains**

1. **MCP Access**: Chat can now search code, analyze repositories
2. **Code Reduction**: ~150 lines → ~30 lines of streaming logic
3. **Better Error Handling**: Built-in Pydantic AI resilience
4. **Conversation Context**: Automatic conversation management
5. **Tool Integration**: Automatic MCP tool access

### 🔧 **Same Interface**

- **AI SDK V5 Format**: Identical streaming format
- **Same Endpoints**: No frontend changes needed
- **Same Headers**: Same HTTP streaming setup
- **Same Error Handling**: Same error response format

### 🛡️ **Safety Features**

- **Legacy Fallback**: `use_legacy=true` parameter
- **Gradual Rollout**: Can test with specific chats
- **Easy Rollback**: Just change default parameter
- **No Breaking Changes**: Frontend unaffected

## 📈 **Migration Timeline**

**Total Time**: ~2 hours

- Phase 1 (30 min): Add CHAT_ASSISTANT agent type
- Phase 2 (45 min): Create Pydantic AI chat function
- Phase 3 (30 min): Replace main chat endpoint
- Phase 4 (15 min): Update legacy endpoint

## 🧪 **Testing Strategy**

1. **Test with `use_legacy=false`** on development
2. **Compare V5 format output** (should be identical)
3. **Test MCP tool access** in chat conversations
4. **Verify conversation context** works properly
5. **Test error handling** and fallback scenarios

## 🚨 **Rollback Plan**

If issues arise:

1. Set `use_legacy=true` by default
2. Chat reverts to OpenAI streaming
3. No data loss or breaking changes
4. Can debug Pydantic AI issues separately

## 🎯 **Conclusion**

**Migration Complexity**: 🟡 **Moderate** (2 hours)  
**Risk Level**: 🟢 **Low** (easy rollback)  
**Benefit Level**: 🚀 **Massive** (MCP + simplification)

This is a **high-value, low-risk** migration that would:

- Add MCP access to chat (the main goal)
- Reduce code complexity by 80%
- Improve error handling and conversation management
- Maintain identical AI SDK V5 streaming format
- Provide easy rollback if needed

The key insight is that your Universal Agent Factory already does all the heavy lifting - we just need to wire it into the chat endpoints.
