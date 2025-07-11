"""
Generalized Agent Factory Architecture with MCP Integration

This module implements a flexible, modular agent factory system inspired by
Atomic Agents design patterns. It provides a base architecture that can be
extended for any type of agent while maintaining consistency and reusability.

Key Features:
- Generalized BaseAgentFactory for all agent types
- Modular tool registration system
- Type-safe agent specialization
- Direct MCP tool integration
- Atomic design principles (atoms → molecules → organisms)
"""

from pydantic_ai import Agent, RunContext
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional, Type, Callable, Generic, TypeVar
from abc import ABC, abstractmethod
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Generic types for agent factory pattern
T = TypeVar("T", bound=BaseModel)
R = TypeVar("R", bound=BaseModel)


class BaseAgentDependencies(BaseModel):
    """Base dependencies that all agents share"""

    repository_name: str
    agent_type: str
    user_query: str
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class BaseAgentResult(BaseModel):
    """Base result structure that all agents return"""

    content: str
    metadata: Dict[str, Any]
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)
    sources: List[str] = Field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    agent_type: str


class AgentSpecialization(BaseModel):
    """Configuration for agent specialization"""

    name: str
    description: str
    system_prompt: str
    tools: List[str] = Field(default_factory=list)
    model: str = "openai:gpt-4o-mini"


class BaseAgentFactory(ABC, Generic[T, R]):
    """
    Abstract base factory for creating specialized agents.

    This follows the Atomic Agents pattern where:
    - Atoms: Individual tools and prompts
    - Molecules: Agent specializations
    - Organisms: Complete agent systems

    Any agent type can extend this factory to create specialized variants.
    """

    def __init__(
        self,
        agent_type: str,
        base_system_prompt: str,
        dependencies_type: Type[T],
        result_type: Type[R],
    ):
        """
        Initialize the base agent factory.

        Args:
            agent_type: Type of agent (e.g., 'documentation', 'analysis', 'support')
            base_system_prompt: Base prompt that applies to all specializations
            dependencies_type: Pydantic model for agent dependencies
            result_type: Pydantic model for agent results
        """
        self.agent_type = agent_type
        self.base_system_prompt = base_system_prompt
        self.dependencies_type = dependencies_type
        self.result_type = result_type

        # Registry for tools and specializations
        self.tool_registry: Dict[str, Callable] = {}
        self.specializations: Dict[str, AgentSpecialization] = {}

        # Initialize base components
        self._register_base_tools()
        self._define_specializations()

    @abstractmethod
    def _register_base_tools(self) -> None:
        """Register base tools that all specializations can use"""
        pass

    @abstractmethod
    def _define_specializations(self) -> None:
        """Define available specializations for this agent type"""
        pass

    def register_tool(self, name: str, tool_func: Callable) -> None:
        """Register a tool function"""
        self.tool_registry[name] = tool_func
        logger.info(f"Registered tool: {name}")

    def register_specialization(self, specialization: AgentSpecialization) -> None:
        """Register a new agent specialization"""
        self.specializations[specialization.name] = specialization
        logger.info(f"Registered specialization: {specialization.name}")

    def _create_base_agent(self, specialization_name: str) -> Agent:
        """Create base agent with specified specialization"""
        if specialization_name not in self.specializations:
            raise ValueError(f"Unknown specialization: {specialization_name}")

        spec = self.specializations[specialization_name]

        # Combine base prompt with specialization prompt
        combined_prompt = f"{self.base_system_prompt}\n\n{spec.system_prompt}"

        agent = Agent(
            spec.model,
            deps_type=self.dependencies_type,
            result_type=self.result_type,
            system_prompt=combined_prompt,
        )

        # Register tools for this specialization
        self._register_agent_tools(agent, spec.tools)

        return agent

    def _register_agent_tools(self, agent: Agent, tool_names: List[str]) -> None:
        """Register specified tools with the agent"""
        for tool_name in tool_names:
            if tool_name in self.tool_registry:
                # Create tool wrapper that binds to this agent
                tool_func = self.tool_registry[tool_name]
                agent.tool(tool_func)
            else:
                logger.warning(f"Tool not found in registry: {tool_name}")

    def create_specialized_agent(self, specialization_name: str) -> Agent:
        """Create a specialized agent"""
        return self._create_base_agent(specialization_name)

    async def run_agent(
        self,
        specialization_name: str,
        user_query: str,
        repository_name: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> R:
        """Run a specialized agent with the given inputs"""
        agent = self.create_specialized_agent(specialization_name)

        # Create dependencies
        deps = self.dependencies_type(
            repository_name=repository_name,
            agent_type=f"{self.agent_type}_{specialization_name}",
            user_query=user_query,
            context=context or {},
        )

        # Run agent
        result = await agent.run(user_query, deps=deps)
        return result.data

    def get_available_specializations(self) -> List[str]:
        """Get list of available specializations"""
        return list(self.specializations.keys())

    def get_specialization_info(self, name: str) -> Optional[AgentSpecialization]:
        """Get information about a specific specialization"""
        return self.specializations.get(name)


class MCPToolMixin:
    """Mixin for MCP tool integration"""

    def register_mcp_tools(self) -> None:
        """Register standard MCP tools"""

        def create_mcp_tool(tool_name: str, description: str):
            async def mcp_tool(ctx: RunContext, **kwargs) -> Dict[str, Any]:
                """Generic MCP tool wrapper"""
                try:
                    # This would integrate with actual MCP tools
                    # For now, we'll return a structured response
                    return {
                        "tool_name": tool_name,
                        "repository": getattr(ctx.deps, "repository_name", "unknown"),
                        "parameters": kwargs,
                        "result": f"MCP tool {tool_name} executed successfully",
                        "status": "success",
                    }
                except Exception as e:
                    logger.error(f"Error in MCP tool {tool_name}: {e}")
                    return {"tool_name": tool_name, "error": str(e), "status": "error"}

            mcp_tool.__name__ = tool_name
            mcp_tool.__doc__ = description
            return mcp_tool

        # Register standard MCP tools
        mcp_tools = [
            ("search_codebase", "Search codebase for patterns and implementations"),
            ("find_entities", "Find code entities like functions, classes, and files"),
            ("get_entity_relationships", "Get relationships between code entities"),
            ("qa_codebase", "Get comprehensive codebase insights with diagrams"),
        ]

        for tool_name, description in mcp_tools:
            self.register_tool(tool_name, create_mcp_tool(tool_name, description))


# Specific implementation for Documentation Agents
class DocumentationDependencies(BaseAgentDependencies):
    """Dependencies specific to documentation agents"""

    documentation_type: str

    @property
    def agent_type(self) -> str:
        return f"documentation_{self.documentation_type}"


class DocumentationResult(BaseAgentResult):
    """Result specific to documentation agents"""

    documentation_type: str
    sections: List[Dict[str, Any]] = Field(default_factory=list)
    diagrams: List[str] = Field(default_factory=list)


class DocumentationAgentFactory(
    BaseAgentFactory[DocumentationDependencies, DocumentationResult], MCPToolMixin
):
    """
    Specialized factory for documentation agents.

    This demonstrates how to extend the base factory for specific use cases
    while maintaining the atomic design principles.
    """

    def __init__(self):
        base_prompt = """You are a specialized documentation agent with access to powerful MCP tools for codebase analysis.

Available MCP Tools:
- search_codebase: Search for code patterns and implementations
- find_entities: Discover functions, classes, and files
- get_entity_relationships: Map dependencies and relationships
- qa_codebase: Get comprehensive codebase insights with diagrams

Your Approach:
1. Always use MULTIPLE tools to cross-validate findings
2. Start with broad searches, then narrow down to specifics
3. Provide comprehensive analysis with concrete examples
4. Include code references and line numbers when available
5. Generate structured, actionable documentation

Remember: You have direct access to the codebase through MCP tools - use them extensively!"""

        super().__init__(
            agent_type="documentation",
            base_system_prompt=base_prompt,
            dependencies_type=DocumentationDependencies,
            result_type=DocumentationResult,
        )

    def _register_base_tools(self) -> None:
        """Register MCP tools for documentation"""
        self.register_mcp_tools()

    def _define_specializations(self) -> None:
        """Define documentation-specific specializations"""
        specializations = [
            AgentSpecialization(
                name="system_overview",
                description="High-level architecture and system design overview",
                system_prompt="""
SPECIALIZATION: System Architecture Overview Expert

Focus on high-level architecture, main components, and system design patterns.

Your Analysis Process:
1. Use find_entities to map overall project structure
2. Use qa_codebase to understand architectural patterns
3. Use search_codebase to find configuration and setup files
4. Use get_entity_relationships to understand component interactions

Generate comprehensive documentation including:
- Architecture diagrams (mermaid format)
- Core technologies and their relationships
- Key design patterns used
- System requirements and dependencies
- Project structure explanation
- Component interaction flows

Be technical yet accessible, focusing on system-level understanding.
""",
                tools=[
                    "search_codebase",
                    "find_entities",
                    "get_entity_relationships",
                    "qa_codebase",
                ],
            ),
            AgentSpecialization(
                name="api_overview",
                description="Comprehensive API documentation with endpoints and schemas",
                system_prompt="""
SPECIALIZATION: API Documentation Expert

Focus on API endpoints, request/response patterns, and integration points.

Your Analysis Process:
1. Use search_codebase to find API routes and controllers
2. Use find_entities to identify API-related classes and functions
3. Use get_entity_relationships to map API dependencies
4. Use qa_codebase to understand API architecture

Generate comprehensive API documentation including:
- API endpoint inventory with methods and paths
- Request/response schemas and examples
- Authentication and authorization patterns
- Error handling and status codes
- API integration patterns
- OpenAPI/Swagger documentation where available

Focus on practical API usage for developers and integrators.
""",
                tools=[
                    "search_codebase",
                    "find_entities",
                    "get_entity_relationships",
                    "qa_codebase",
                ],
            ),
            # Add more specializations...
        ]

        for spec in specializations:
            self.register_specialization(spec)


# Example of how to create other agent types
class AnalysisAgentFactory(
    BaseAgentFactory[BaseAgentDependencies, BaseAgentResult], MCPToolMixin
):
    """Example of creating a different agent type using the same pattern"""

    def __init__(self):
        base_prompt = """You are a code analysis expert with deep understanding of software architecture and quality metrics."""

        super().__init__(
            agent_type="analysis",
            base_system_prompt=base_prompt,
            dependencies_type=BaseAgentDependencies,
            result_type=BaseAgentResult,
        )

    def _register_base_tools(self) -> None:
        self.register_mcp_tools()
        # Add analysis-specific tools

    def _define_specializations(self) -> None:
        # Define analysis-specific specializations
        pass


# Global factory instances
documentation_agent_factory = DocumentationAgentFactory()
analysis_agent_factory = AnalysisAgentFactory()


# Factory registry for dynamic agent creation
AGENT_FACTORIES: Dict[str, BaseAgentFactory] = {
    "documentation": documentation_agent_factory,
    "analysis": analysis_agent_factory,
}


def get_agent_factory(agent_type: str) -> BaseAgentFactory:
    """Get an agent factory by type"""
    if agent_type not in AGENT_FACTORIES:
        raise ValueError(
            f"Unknown agent type: {agent_type}. Available: {list(AGENT_FACTORIES.keys())}"
        )
    return AGENT_FACTORIES[agent_type]


def register_agent_factory(agent_type: str, factory: BaseAgentFactory) -> None:
    """Register a new agent factory"""
    AGENT_FACTORIES[agent_type] = factory
    logger.info(f"Registered agent factory: {agent_type}")
