"""
Modern Generalized Agent Architecture

This module provides a flexible, modular agent architecture based on Atomic Agents
design patterns. It supports creating any type of agent while maintaining consistency
and reusability.

Architecture Components:
- BaseAgentFactory: Abstract factory for all agent types
- MCPToolMixin: Reusable MCP tool integration
- AgentSpecialization: Configuration for agent variants
- Type-safe dependencies and results

Available Agent Types:
- Documentation: System docs, API docs, guides
- Support: Technical support, user onboarding
- Security: Vulnerability assessment, compliance
- Performance: Bottleneck analysis, optimization
- Analysis: Code analysis, quality metrics

Usage Example:
    from api.agents import get_agent_factory

    # Get a documentation agent
    doc_factory = get_agent_factory("documentation")
    agent = doc_factory.create_specialized_agent("system_overview")

    # Run the agent
    result = await doc_factory.run_agent(
        "system_overview",
        "Analyze the system architecture",
        "my-repo"
    )
"""

from .core import (
    BaseAgentFactory,
    BaseAgentDependencies,
    BaseAgentResult,
    AgentSpecialization,
    MCPToolMixin,
    DocumentationAgentFactory,
    documentation_agent_factory,
    get_agent_factory,
    register_agent_factory,
    AGENT_FACTORIES,
)

# Import examples to auto-register additional agent types
from . import examples

__all__ = [
    # Core architecture
    "BaseAgentFactory",
    "BaseAgentDependencies",
    "BaseAgentResult",
    "AgentSpecialization",
    "MCPToolMixin",
    # Documentation agents (primary use case)
    "DocumentationAgentFactory",
    "documentation_agent_factory",
    # Factory management
    "get_agent_factory",
    "register_agent_factory",
    "AGENT_FACTORIES",
]
