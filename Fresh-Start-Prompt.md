# 🚀 Backend Simplification: Phase 1 Implementation

## Context & Mission

You are implementing **Phase 1** of the [Backend Simplification Plan](./Backend-Simplification-Plan.md) - transitioning from a complex, over-engineered backend to a modern **Pydantic AI architecture** with direct MCP integration.

### Current State Analysis

- **Complex Agent System**: 7+ specialized agents with manual orchestration in `api/routers/agents.py`
- **Indirect MCP Integration**: Custom HTTP client to `localhost:7779/indexer` via `CodeSearch` class
- **Over-engineered Pipeline**: Strategy pattern with multiple inheritance in `api/documentation/strategies/`

### Target: Modern Pydantic AI Foundation

Transform to a **single agent factory** using [Pydantic AI's latest patterns](https://ai.pydantic.dev/api/agent/) with direct MCP tool integration via the [`mcp_servers` parameter](https://ai.pydantic.dev/mcp/client/).

## Phase 1 Implementation Requirements

### 📋 **Immediate Tasks (Phase 1)**

1. **Install Modern Dependencies**

   - Add `pydantic-ai` and `mcp-client` to `api/requirements.txt`
   - Follow [Pydantic AI installation guide](https://ai.pydantic.dev/install/)

2. **Create Agent Factory Architecture**

   - Create `api/agents/` directory structure
   - Implement `api/agents/core.py` with `DocumentationAgentFactory` class
   - Create `api/agents/__init__.py` for proper module structure

3. **Implement Direct MCP Integration**

   - Use `mcp_servers` parameter for direct tool access (not HTTP client)
   - Connect to existing MCP server at `localhost:8009/sse/`
   - Register tools: `mcp_search_code`, `mcp_find_entities`, `mcp_get_entity_relationships`, `mcp_qa_codebase`

4. **Create Dynamic System Prompts**
   - Implement specialized prompts for each documentation type
   - Maintain current functionality: `system_overview`, `component_analysis`, `api_overview`, etc.

### 🎯 **Key Files to Create/Modify**

#### New Files (Phase 1):

- `api/agents/core.py` - Main agent factory implementation
- `api/agents/__init__.py` - Module initialization

#### Files to Modify:

- `api/requirements.txt` - Add new dependencies
- `api/routers/agents.py` - Update to use new agent factory (minimal changes for Phase 1)

#### Reference Current Implementation:

- `api/routers/agents.py` (lines 396-496) - Current complex agent definitions
- `api/documentation/strategies/` - Current strategy pattern to replace
- `api/utils/tools.py` - Current `CodeSearch` class to eliminate

### 🔧 **Technical Specifications**

#### Agent Factory Pattern (based on [Pydantic AI docs](https://ai.pydantic.dev/api/agent/)):

```python
from pydantic_ai import Agent, RunContext
from pydantic import BaseModel
from typing import Dict, Any, List

class DocumentationDependencies(BaseModel):
    repository_name: str
    documentation_type: str
    user_query: str

class DocumentationResult(BaseModel):
    content: str
    metadata: Dict[str, Any]
    confidence: float
    sources: List[str]

class DocumentationAgentFactory:
    def __init__(self):
        self.agent = Agent(
            'openai:gpt-4o',
            deps_type=DocumentationDependencies,
            result_type=DocumentationResult,
            # Direct MCP integration - no HTTP client needed
            mcp_servers=[{
                'name': 'codebase-tools',
                'url': 'http://localhost:8009/sse/',
                'tools': ['mcp_search_code', 'mcp_find_entities', 'mcp_get_entity_relationships', 'mcp_qa_codebase']
            }]
        )
```

#### MCP Tool Integration (following [MCP client guide](https://ai.pydantic.dev/mcp/client/)):

```python
@agent.tool
async def search_codebase(ctx: RunContext[DocumentationDependencies], query: str) -> Dict[str, Any]:
    """Direct MCP tool call - eliminates HTTP client overhead"""
    return await ctx.call_mcp_tool('mcp_search_code', {
        'query': query,
        'repo_name': ctx.deps.repository_name,
        'limit': 10
    })
```

### 📊 **Success Metrics for Phase 1**

- **Agent Reduction**: 7+ agents → 1 factory class
- **Code Elimination**: Remove `CodeSearch` HTTP client pattern
- **MCP Integration**: Direct tool access via `mcp_servers`
- **Compatibility**: Maintain existing API contracts for frontend

### 🔍 **Architecture Comparison**

#### Before (Complex):

```python
# Current: api/routers/agents.py (lines 396-496)
docs_agent = PydanticAgent(model=gpt_4o_mini, deps_type=CodeSearch, ...)
system_overview_agent = PydanticAgent(model=gpt_4o_mini, deps_type=CodeSearch, ...)
component_analysis_agent = PydanticAgent(model=gpt_4o_mini, deps_type=CodeSearch, ...)
# ... 7+ more agents
```

#### After (Simplified):

```python
# New: api/agents/core.py
agent_factory = DocumentationAgentFactory()
specialized_agent = agent_factory.create_specialized_agent('system_overview')
```

### 🎯 **Next Steps Todo List**

Create a comprehensive todo list using the `todo_write` tool with these specific tasks:

1. **Setup Phase 1 Foundation**

   - Install pydantic-ai dependencies
   - Create agents directory structure
   - Implement DocumentationAgentFactory class

2. **MCP Integration Implementation**

   - Remove CodeSearch HTTP client dependencies
   - Implement direct MCP tool integration
   - Test MCP server connection

3. **Specialized Agent Creation**

   - Implement dynamic system prompts
   - Create agent specialization logic
   - Maintain backward compatibility

4. **Integration Testing**
   - Test agent factory with existing endpoints
   - Verify MCP tool functionality
   - Validate response formats

### 🔗 **Key Documentation References**

- [Pydantic AI Agent API](https://ai.pydantic.dev/api/agent/) - Core agent patterns
- [MCP Client Integration](https://ai.pydantic.dev/mcp/client/) - Direct tool integration
- [Agent Tools Documentation](https://ai.pydantic.dev/tools/) - Tool registration patterns
- [Dependency Injection](https://ai.pydantic.dev/dependencies/) - Context management

### 🚨 **Critical Implementation Notes**

1. **Maintain API Compatibility**: Keep existing endpoint contracts for frontend
2. **Preserve Chat Integration**: Don't break existing chat/message functionality
3. **MCP Server Dependency**: Ensure `localhost:8009/sse/` is accessible
4. **Error Handling**: Implement robust error handling for MCP tool failures
5. **Testing Strategy**: Test each component before integration

### 💡 **Phase 1 Success Criteria**

- [ ] Single `DocumentationAgentFactory` replaces multiple agent definitions
- [ ] Direct MCP tool integration eliminates HTTP client overhead
- [ ] Specialized agents maintain current documentation quality
- [ ] Existing API endpoints continue to function
- [ ] 85% reduction in agent-related code complexity

## Implementation Priority

**START HERE**: Begin with dependency installation and agent factory creation. This phase focuses on **foundation building** - creating the modern Pydantic AI architecture that will support all subsequent phases.

**Next Phase Preview**: Phase 2 will eliminate the remaining HTTP client code and fully integrate MCP tools, followed by pipeline simplification in Phase 3.

---

_This prompt should be used with the [Backend Simplification Plan](./Backend-Simplification-Plan.md) as reference. The plan contains detailed technical specifications, architecture diagrams, and complete implementation guidance for all phases._
