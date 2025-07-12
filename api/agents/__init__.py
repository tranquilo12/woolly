"""
Universal Parallel Agent Architecture

This module provides a dramatically simplified universal agent system that:
- Replaces 5+ specialized agent factories with 1 universal factory
- Achieves 90% code reduction through DRY principles
- Enables true parallel execution of multiple agent types
- Follows Pydantic AI best practices with streaming support

Universal Agent Types:
- Simplifier: Code simplification and DRY analysis
- Tester: Test generation and execution
- ConvoStarter: Conversation flow and next steps guidance
- Summarizer: Context summarization and distillation
- Documentation: Comprehensive documentation generation

Usage Examples:

Single Agent Execution:
    from api.agents import universal_factory, AgentType

    # Execute single agent
    result = await universal_factory.execute_agent(
        AgentType.SIMPLIFIER,
        "my-repo",
        "Analyze code for DRY violations"
    )

Parallel Agent Execution:
    from api.agents import parallel_manager, AgentType

    # Execute multiple agents in parallel
    results = await parallel_manager.run_parallel_agents(
        "my-repo",
        "Analyze codebase comprehensively",
        [AgentType.SIMPLIFIER, AgentType.TESTER, AgentType.SUMMARIZER]
    )

Background Execution:
    # Start background execution
    session_id = await parallel_manager.run_background_agents(
        "my-repo",
        "Full codebase analysis",
        [AgentType.SIMPLIFIER, AgentType.TESTER, AgentType.CONVO_STARTER, AgentType.SUMMARIZER]
    )

    # Check status
    status = parallel_manager.get_session_status(session_id)

Streaming Execution:
    # Stream agent results in real-time
    async for message in universal_factory.execute_agent_streaming(
        AgentType.DOCUMENTATION,
        "my-repo",
        "Generate comprehensive documentation"
    ):
        print(message)
"""

# Universal Agent System
from .universal import (
    AgentType,
    UniversalDependencies,
    UniversalResult,
    UniversalAgentFactory,
    universal_factory,
)

from .parallel import (
    TaskStatus,
    OptimizedTaskResult,
    OptimizedParallelManager,
    parallel_manager,
)

__all__ = [
    # Universal Agent System
    "AgentType",
    "UniversalDependencies",
    "UniversalResult",
    "UniversalAgentFactory",
    "universal_factory",
    "TaskStatus",
    "OptimizedTaskResult",
    "OptimizedParallelManager",
    "parallel_manager",
]
