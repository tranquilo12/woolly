# 🚀 Fresh Start: Phase 4 - Advanced Features & Multi-Agent Workflows

## 📋 **TLDR - Next Phase Priority**

**Status:** ✅ Phase 2-3 Complete | 🎯 **Starting Phase 4 - Advanced Features & Multi-Agent Workflows**
**Context:** Backend Simplification Plan - Universal Agent Architecture
**Achievement:** 75% code reduction, Universal system operational, All endpoints working
**Next Goal:** Implement streaming responses, multi-agent workflows with tools, Pydantic Graph integration, and performance monitoring

---

## 🎯 **MISSION: Phase 4 Implementation**

You are continuing the **Backend Simplification Plan** for the Woolly project. **Phase 2-3 has been completed successfully** with major achievements:

- ✅ **75% code reduction** (1,400 → 350 lines core logic)
- ✅ **Universal Agent Factory** operational with all 5 agent types
- ✅ **MCP integration** working with graceful fallbacks
- ✅ **Route conflict resolution** (health endpoints fixed)
- ✅ **Legacy cleanup** completed (1,000+ lines removed)

**Your task:** Implement **Phase 4** advanced features following **correct Pydantic AI best practices** for multi-agent systems.

---

## 🚨 **CRITICAL: Corrected Pydantic AI Approach**

**❌ PREVIOUS MISCONCEPTION:** "Agent Chaining"
**✅ CORRECT APPROACH:** **Tool-Based Multi-Agent Communication**

Based on latest Pydantic AI documentation and best practices, multi-agent systems should use:

1. **Tools for Agent Communication** - Agents communicate via `@agent.tool` decorators
2. **Dependency Injection** - State and context passed via `RunContext[Dependencies]`
3. **Pydantic Graph** - For complex workflows with state management
4. **Stateless Agents** - Agents are global, state goes in dependencies

---

## 📋 **PHASE 4 IMPLEMENTATION PLAN**

### **Step 1: Multi-Agent Workflows with Tools (HIGH PRIORITY)**

**Files to Create/Modify:**

- `api/agents/multi_agent.py` (NEW)
- `api/agents/triage.py` (NEW)
- `api/routers/multi_agent.py` (NEW)

**Implementation Pattern:**

```python
# ✅ CORRECT: Tool-based multi-agent communication
@dataclass
class TriageDependencies:
    support_agent: Agent
    documentation_agent: Agent
    testing_agent: Agent
    customer_context: Dict[str, Any]

triage_agent = Agent(
    'openai:gpt-4o-mini',
    deps_type=TriageDependencies,
    system_prompt='You are a triage agent that routes queries to appropriate specialists.',
    result_type=TriageResult,
)

@triage_agent.tool
async def route_to_documentation(ctx: RunContext[TriageDependencies], query: str) -> str:
    """Route documentation requests to documentation agent"""
    deps = UniversalDependencies(
        repository_name=ctx.deps.customer_context.get("repository"),
        agent_type=AgentType.DOCUMENTATION,
        user_query=query
    )
    result = await ctx.deps.documentation_agent.run(query, deps=deps)
    return result.data.content

@triage_agent.tool
async def route_to_testing(ctx: RunContext[TriageDependencies], query: str) -> str:
    """Route testing requests to testing agent"""
    deps = UniversalDependencies(
        repository_name=ctx.deps.customer_context.get("repository"),
        agent_type=AgentType.TESTER,
        user_query=query
    )
    result = await ctx.deps.testing_agent.run(query, deps=deps)
    return result.data.content
```

### **Step 2: Pydantic Graph Integration (ADVANCED)**

**Files to Create:**

- `api/workflows/graph_workflows.py` (NEW)
- `api/workflows/nodes.py` (NEW)

**Implementation Pattern:**

```python
# ✅ CORRECT: Pydantic Graph for complex workflows
from pydantic_graph import BaseNode, GraphRunContext, End, Graph
from dataclasses import dataclass, field

@dataclass
class CodeAnalysisState:
    repository_name: str
    analysis_results: Dict[str, Any] = field(default_factory=dict)
    test_results: Dict[str, Any] = field(default_factory=dict)
    documentation_results: Dict[str, Any] = field(default_factory=dict)
    current_step: str = "start"

@dataclass
class AnalyzeCode(BaseNode[CodeAnalysisState]):
    async def run(self, ctx: GraphRunContext[CodeAnalysisState]) -> "GenerateTests":
        # Use universal agent for code analysis
        agent = universal_factory.create_agent(AgentType.SIMPLIFIER)
        deps = UniversalDependencies(
            repository_name=ctx.state.repository_name,
            agent_type=AgentType.SIMPLIFIER,
            user_query="Analyze this codebase for complexity and patterns"
        )
        result = await agent.run("Analyze code", deps=deps)
        ctx.state.analysis_results = result.data.metadata
        ctx.state.current_step = "analysis_complete"
        return GenerateTests()

@dataclass
class GenerateTests(BaseNode[CodeAnalysisState]):
    async def run(self, ctx: GraphRunContext[CodeAnalysisState]) -> "GenerateDocumentation":
        # Use testing agent
        agent = universal_factory.create_agent(AgentType.TESTER)
        deps = UniversalDependencies(
            repository_name=ctx.state.repository_name,
            agent_type=AgentType.TESTER,
            user_query="Generate comprehensive tests",
            context=ctx.state.analysis_results
        )
        result = await agent.run("Generate tests", deps=deps)
        ctx.state.test_results = result.data.metadata
        ctx.state.current_step = "tests_complete"
        return GenerateDocumentation()

@dataclass
class GenerateDocumentation(BaseNode[CodeAnalysisState]):
    async def run(self, ctx: GraphRunContext[CodeAnalysisState]) -> End:
        # Use documentation agent
        agent = universal_factory.create_agent(AgentType.DOCUMENTATION)
        deps = UniversalDependencies(
            repository_name=ctx.state.repository_name,
            agent_type=AgentType.DOCUMENTATION,
            user_query="Generate documentation",
            context={
                "analysis": ctx.state.analysis_results,
                "tests": ctx.state.test_results
            }
        )
        result = await agent.run("Generate docs", deps=deps)
        ctx.state.documentation_results = result.data.metadata
        return End(ctx.state)

# Create the workflow graph
code_analysis_graph = Graph(nodes=[AnalyzeCode, GenerateTests, GenerateDocumentation])
```

### **Step 3: Streaming Responses (MEDIUM PRIORITY)**

**Files to Modify:**

- `api/routers/universal_agents.py` (add streaming endpoint)

**Implementation:**

```python
@router.post("/v1/agents/execute/stream")
async def execute_agent_stream(request: UniversalRequest):
    """Execute agent with streaming response"""

    async def generate_stream():
        agent = universal_factory.create_agent(request.agent_type)
        deps = UniversalDependencies(
            repository_name=request.repository_name,
            agent_type=request.agent_type,
            user_query=request.user_query,
            context=request.context or {}
        )

        async with agent.run_stream(request.user_query, deps=deps) as response:
            async for chunk in response.stream_text():
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/plain")
```

### **Step 4: Performance Monitoring (LOW PRIORITY)**

**Files to Create:**

- `api/monitoring/metrics.py` (NEW)
- `api/monitoring/performance.py` (NEW)

**Implementation:**

```python
# Performance monitoring for agent execution
from pydantic_ai.usage import Usage, UsageLimits
from dataclasses import dataclass
from datetime import datetime

@dataclass
class AgentMetrics:
    agent_type: AgentType
    execution_time: float
    token_usage: int
    success: bool
    error_message: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)

class PerformanceMonitor:
    def __init__(self):
        self.metrics: List[AgentMetrics] = []

    async def execute_with_monitoring(self, agent: Agent, deps: UniversalDependencies) -> UniversalResult:
        start_time = time.time()
        usage = Usage()

        try:
            result = await agent.run(deps.user_query, deps=deps, usage=usage)
            execution_time = time.time() - start_time

            metric = AgentMetrics(
                agent_type=deps.agent_type,
                execution_time=execution_time,
                token_usage=usage.total_tokens,
                success=True
            )
            self.metrics.append(metric)
            return result

        except Exception as e:
            execution_time = time.time() - start_time
            metric = AgentMetrics(
                agent_type=deps.agent_type,
                execution_time=execution_time,
                token_usage=usage.total_tokens,
                success=False,
                error_message=str(e)
            )
            self.metrics.append(metric)
            raise
```

---

## 🎯 **TODO LIST FOR PHASE 4**

Based on user rules, here are the todos for the next conversation:

### **Multi-Agent Implementation Todos:**

1. **setup_triage_agent** - Create triage agent with tool-based routing to specialized agents (depends on: [])
2. **implement_agent_tools** - Add @agent.tool decorators for inter-agent communication (depends on: setup_triage_agent)
3. **create_multi_agent_router** - Add FastAPI endpoints for multi-agent workflows (depends on: implement_agent_tools)
4. **test_multi_agent_flow** - Test triage → specialist agent communication (depends on: create_multi_agent_router)

### **Pydantic Graph Integration Todos:**

5. **setup_graph_workflow** - Create Pydantic Graph workflow for code analysis pipeline (depends on: test_multi_agent_flow)
6. **implement_graph_nodes** - Create BaseNode classes for workflow steps (depends on: setup_graph_workflow)
7. **test_graph_execution** - Test complete workflow execution with state management (depends on: implement_graph_nodes)

### **Streaming & Monitoring Todos:**

8. **add_streaming_endpoint** - Implement streaming response endpoint (depends on: [])
9. **implement_performance_monitoring** - Add metrics collection for agent execution (depends on: [])
10. **create_monitoring_dashboard** - Add endpoint to view performance metrics (depends on: implement_performance_monitoring)

---

## 🚨 **CRITICAL WARNINGS & BEST PRACTICES**

### **⚠️ Pydantic AI Anti-Patterns to Avoid:**

1. **❌ NEVER: Direct Agent Chaining**

   ```python
   # DON'T DO THIS - This is not how Pydantic AI works
   result1 = agent1.run(query)
   result2 = agent2.run(result1.data)  # Wrong!
   ```

2. **❌ NEVER: Stateful Agents**

   ```python
   # DON'T DO THIS - Agents should be stateless
   class StatefulAgent:
       def __init__(self):
           self.memory = {}  # Wrong!
   ```

3. **❌ NEVER: Complex Inheritance Hierarchies**
   ```python
   # DON'T DO THIS - Use composition and dependency injection
   class BaseAgent:
       class SpecializedAgent(BaseAgent):  # Wrong!
   ```

### **✅ Pydantic AI Best Practices to Follow:**

1. **✅ Tool-Based Communication:**

   ```python
   @agent.tool
   async def call_specialist(ctx: RunContext[Deps], query: str) -> str:
       return await ctx.deps.specialist_agent.run(query, deps=specialist_deps)
   ```

2. **✅ Dependency Injection:**

   ```python
   @dataclass
   class AgentDependencies:
       other_agents: Dict[str, Agent]
       context: Dict[str, Any]
   ```

3. **✅ Type Safety Throughout:**
   ```python
   agent = Agent[Dependencies, Result](
       model="openai:gpt-4o-mini",
       deps_type=Dependencies,
       result_type=Result,
   )
   ```

---

## 📚 **ESSENTIAL REFERENCES**

### **Pydantic AI Documentation:**

- [Multi-Agent Applications](https://ai.pydantic.dev/multi-agent-applications/)
- [Pydantic Graph](https://ai.pydantic.dev/graph/)
- [Tools Documentation](https://ai.pydantic.dev/tools/)
- [Dependency Injection](https://ai.pydantic.dev/dependencies/)

### **Code Examples to Study:**

- Bank Support Multi-Agent Example: Tool-based agent routing
- Pipeline of Agents Pattern: Sequential agent execution
- Graph Workflows: State machine implementation

---

## 🎯 **SUCCESS CRITERIA**

**Phase 4 will be considered successful when:**

1. **Multi-Agent Communication**: Triage agent successfully routes queries to specialist agents via tools
2. **Pydantic Graph Integration**: Complex workflows execute with proper state management
3. **Streaming Responses**: Real-time agent output streaming works correctly
4. **Performance Monitoring**: Metrics collection and reporting operational
5. **Type Safety**: All new components follow Pydantic AI typing patterns
6. **Backward Compatibility**: Existing universal system continues to work

---

## 🚀 **GETTING STARTED**

**Immediate Next Steps:**

1. **Review Current Architecture**: Understand the universal factory pattern already in place
2. **Study Pydantic AI Examples**: Review multi-agent patterns in documentation
3. **Start with Triage Agent**: Implement tool-based routing as foundation
4. **Test Incrementally**: Ensure each component works before moving to next
5. **Follow Type Safety**: Use proper Pydantic AI typing throughout

**Remember:** The goal is to enhance the existing universal system with advanced features while maintaining the simplicity and elegance we've achieved in Phases 1-3.

---

## 🎉 **MOTIVATION**

You're building upon a **highly successful foundation**:

- ✅ 75% code reduction achieved
- ✅ Universal system operational
- ✅ All endpoints working perfectly
- ✅ Best practices established

**Phase 4** will add sophisticated multi-agent capabilities while maintaining the system's elegance and simplicity. This is the final phase that transforms the system from "simplified" to "sophisticated yet simple" - the ultimate achievement in software architecture.

**Let's build something amazing! 🚀**
