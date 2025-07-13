# 🚀 Fresh Start: Phase 4 Conversation History & Entity Discovery Fix

## 📋 **TLDR - Next Page**

**Current Status:** Phase 4 at 95% completion - Universal Agent Factory operational, MCP integration working, but conversation history and entity discovery workflow needs proper implementation

**Critical Issues to Resolve:**

1. **Conversation History Management** - Not using proper Pydantic AI message history patterns
2. **Entity Discovery Protocol** - Agents requesting UUIDs that don't exist because conversation context isn't maintained properly
3. **Tool Call Interception Misconception** - Current approach is not how Pydantic AI works

**Next Logical Stage:** Phase 4 Completion - Implement proper Pydantic AI conversation history and entity discovery workflow

---

## 🎯 **MISSION BRIEFING**

You are continuing the **Backend Simplification Plan** (see attached `Backend-Simplification-Plan.md`) at **Phase 4: Advanced MCP Integration**. The Universal Agent Factory has been successfully implemented with **81% code reduction** and all 5 agent types are operational, but the conversation history and entity discovery workflow needs to be implemented using proper Pydantic AI patterns.

### **🔴 CRITICAL PROBLEMS TO SOLVE**

#### **Problem 1: Incorrect Conversation History Implementation**

**File:** `api/agents/universal.py` (lines 150-250)
**Issue:** The current `ConversationContext` and tool call interception approach is not how Pydantic AI handles conversation history. Pydantic AI uses `message_history` parameter with `ModelMessage` objects.

#### **Problem 2: Entity Discovery Protocol Failing**

**Issue:** Agents are requesting UUIDs that don't exist because they're not maintaining proper conversation context with discovered entities across multiple `agent.run()` calls.

**MCP Server Logs Show:**

```
ERROR: Entity ID '123e4567-e89b-12d3-a456-426614174000' not found in repository 'woolly'
```

#### **Problem 3: Tool Call Interception Misconception**

**Issue:** Pydantic AI doesn't have built-in tool call interception. Tool calls are handled internally by the agent. The current approach of trying to intercept `agent.run()` is incorrect.

### **🎯 WHAT YOU NEED TO ACCOMPLISH**

#### **Phase 4.1: Implement Proper Conversation History (Priority 1)**

**Target File:** `api/agents/universal.py`
**Lines to Focus:** 150-300 (conversation context and agent execution)

**Current Broken Pattern:**

```python
# ❌ WRONG - This is not how Pydantic AI works
class ConversationContext:
    conversation_history: List[Any] = Field(default_factory=list)

def _add_tool_call_interceptor(self, agent: Agent) -> None:
    # This approach is fundamentally incorrect
    original_run = agent.run
    # ... intercepting agent.run is not the right pattern
```

**Correct Pydantic AI Pattern:**

```python
# ✅ CORRECT - Use message_history parameter
from pydantic_ai.messages import ModelMessage

class ConversationContext(BaseModel):
    repository_name: str
    message_history: List[ModelMessage] = Field(default_factory=list)
    discovered_entities: Dict[str, Any] = Field(default_factory=dict)

async def execute_agent_with_context(self, agent_type: AgentType, repository_name: str, user_query: str):
    context = self.get_or_create_conversation_context(repository_name)

    # Use message_history parameter - this is the correct way
    async with agent.run_mcp_servers():
        result = await agent.run(
            user_query,
            deps=dependencies,
            message_history=context.message_history
        )

    # Store the new messages for next interaction
    context.message_history.extend(result.new_messages())
    return result
```

#### **Phase 4.2: Entity Discovery via System Prompts (Priority 2)**

**Target File:** `api/agents/universal.py`
**Lines to Focus:** 200-250 (system prompt enhancement)

**Current Issue:**

```python
# ❌ WRONG - Trying to intercept tool calls
def _update_context_from_tool_result(self, context, tool_name, tool_input, result):
    # This method shouldn't exist - tool calls are internal to Pydantic AI
```

**Correct Approach:**

```python
# ✅ CORRECT - Use system prompts and dependencies to guide entity discovery
def create_agent_with_context(self, agent_type: AgentType, repository_name: str) -> Agent:
    context = self.get_or_create_conversation_context(repository_name)

    # Build system prompt with discovered entities
    base_prompt = self.specializations[agent_type]
    entity_context = self._build_entity_context(context.discovered_entities)

    enhanced_system_prompt = f"""
{base_prompt}

## Entity Discovery Protocol

{entity_context}

IMPORTANT: When working with repositories, follow this sequence:
1. First, use `find_entities` to discover available entities and their IDs
2. Store discovered entity IDs in your working memory
3. Use valid entity IDs for subsequent `get_entity_relationships` calls
4. If you get a 404 error, use `find_entities` again to refresh your entity knowledge

## Previously Discovered Entities for {repository_name}:
{self._format_discovered_entities(context.discovered_entities)}
"""

    return Agent(
        model="openai:gpt-4o-mini",
        deps_type=UniversalDependencies,
        output_type=UniversalResult,
        system_prompt=enhanced_system_prompt,
        mcp_servers=[self.mcp_server] if self.mcp_available else []
    )
```

### **🔧 TECHNICAL ARCHITECTURE CONTEXT**

#### **Current Universal Agent Factory Architecture:**

```python
class UniversalAgentFactory:
    def __init__(self):
        self.mcp_server = MCPServerStreamableHTTP(url="http://localhost:8009/sse/")
        # ✅ This is working correctly

    def create_agent(self, agent_type: AgentType) -> Agent:
        return Agent(
            model="openai:gpt-4o-mini",
            deps_type=UniversalDependencies,
            result_type=UniversalResult,
            system_prompt=self.specializations[agent_type],
            mcp_servers=[self.mcp_server]  # ✅ Native integration working
        )
```

#### **Correct Conversation Context System:**

```python
class ConversationContext(BaseModel):
    repository_name: str
    message_history: List[ModelMessage] = Field(default_factory=list)
    discovered_entities: Dict[str, Any] = Field(default_factory=dict)
    last_entity_discovery: Optional[datetime] = None

    class Config:
        arbitrary_types_allowed = True
```

### **📚 REFERENCE DOCUMENTATION**

#### **Pydantic AI Best Practices (from documentation research):**

1. **Proper Message History Pattern:**

```python
# From Pydantic AI docs - correct conversation history
result1 = agent.run_sync('Tell me a joke.')
result2 = agent.run_sync('Explain?', message_history=result1.new_messages())
# result2.all_messages() now contains the full conversation
```

2. **Message Serialization:**

```python
# From Pydantic AI docs - proper message storage
from pydantic_ai.messages import ModelMessagesTypeAdapter
from pydantic_core import to_jsonable_python

# Store messages
history = result.all_messages()
as_python_objects = to_jsonable_python(history)

# Restore messages
restored_history = ModelMessagesTypeAdapter.validate_python(as_python_objects)
```

3. **System Prompt Enhancement:**

```python
# From Pydantic AI docs - dynamic system prompts
@agent.system_prompt(dynamic=True)
def system_prompt(ctx: RunContext[Dependencies]) -> str:
    return f"Base prompt with context: {ctx.deps.context}"
```

### **🎯 SPECIFIC TODOS FOR NEXT CONVERSATION**

#### **Todo 1: Remove Tool Call Interception System**

- [ ] Remove `_add_tool_call_interceptor` method from `api/agents/universal.py`
- [ ] Remove `_update_context_from_tool_result` method
- [ ] Remove all tool call interception logic - this is not how Pydantic AI works

#### **Todo 2: Implement Proper Conversation History**

- [ ] Replace `ConversationContext.conversation_history: List[Any]` with `message_history: List[ModelMessage]`
- [ ] Update `execute_agent_with_context` to use `message_history` parameter
- [ ] Implement proper message storage using `result.new_messages()`
- [ ] Add message serialization for persistence using `ModelMessagesTypeAdapter`

#### **Todo 3: Entity Discovery via System Prompts**

- [ ] Enhance system prompts to include discovered entity context
- [ ] Implement `_build_entity_context` method to inject entity knowledge
- [ ] Add entity discovery instructions to system prompts
- [ ] Store discovered entities in `ConversationContext.discovered_entities`

#### **Todo 4: Test Proper Conversation Flow**

- [ ] Create test that demonstrates proper message history flow
- [ ] Verify agents maintain context across multiple `agent.run()` calls
- [ ] Test entity discovery through system prompt guidance
- [ ] Confirm no more 404 errors in MCP server logs

### **🔍 FILES TO EXAMINE AND MODIFY**

#### **Primary Target File:**

- `api/agents/universal.py` (lines 150-300) - Core conversation history and entity discovery logic

#### **Supporting Files:**

- `Backend-Simplification-Plan.md` - Overall project context and Phase 4 goals
- `FastMCP-Client-Connection-Guide.md` - MCP integration patterns and best practices
- `test_mcp_agent.py` - Test file for validating fixes

### **🎯 EXPECTED OUTCOMES**

After completing these todos, you should achieve:

1. **Proper Conversation History** - Using Pydantic AI's `message_history` parameter correctly
2. **Entity Discovery via System Prompts** - Agents guided to discover entities through enhanced prompts
3. **No More 404 Errors** - MCP server logs show successful entity lookups
4. **100% Phase 4 Completion** - Universal Agent Factory with full MCP integration

### **🚨 CRITICAL SUCCESS CRITERIA**

- [ ] Remove all tool call interception code (it's not how Pydantic AI works)
- [ ] Implement proper `message_history` parameter usage
- [ ] Entity discovery guided through system prompts and context injection
- [ ] No more stale UUID errors in MCP server logs
- [ ] All 5 agent types work with proper conversation history

### **📖 ARCHITECTURAL PRINCIPLES TO FOLLOW**

1. **Native Pydantic AI Patterns** - Use `message_history` parameter, not custom interception
2. **System Prompt Enhancement** - Guide entity discovery through enhanced prompts
3. **Type Safety Throughout** - Use `ModelMessage` for conversation history
4. **Context via Dependencies** - Pass entity knowledge through dependencies and system prompts
5. **Graceful Fallback** - System works even when MCP server is unavailable

### **⚠️ CRITICAL MISCONCEPTIONS TO CORRECT**

1. **Tool Call Interception Doesn't Exist** - Pydantic AI handles tool calls internally
2. **Don't Intercept agent.run()** - Use `message_history` parameter instead
3. **System Prompts Are Key** - Entity discovery should be guided through prompts, not interception
4. **Use ModelMessage** - Not generic message parts or custom message types

---

## 🎯 **START HERE**

Begin by examining the current tool call interception implementation in `api/agents/universal.py` around lines 200-250. **This entire approach needs to be removed** because it's not how Pydantic AI works.

Instead, focus on implementing proper conversation history using the `message_history` parameter and enhancing system prompts to guide entity discovery.

**Remember:** This is Phase 4 completion - the foundation is solid, we just need to implement proper Pydantic AI conversation patterns for 100% MCP integration success.
