"""
Triage Agent - Intelligent Multi-Agent Routing System

This module implements a triage agent that routes queries to appropriate specialist agents
using the existing UniversalAgentFactory. It follows Pydantic AI best practices:
- Tool-based agent communication
- Dependency injection for context
- Leverages existing MCP tools
- Minimal modification to existing architecture
"""

import logging
from typing import Dict, Any, Optional, List
from enum import Enum
from dataclasses import dataclass
import uuid
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext

from .universal import (
    AgentType,
    UniversalAgentFactory,
    UniversalDependencies,
    UniversalResult,
    universal_factory,
)

logger = logging.getLogger(__name__)


class TriageDecision(str, Enum):
    """Possible triage decisions"""

    SIMPLIFIER = "simplifier"
    TESTER = "tester"
    DOCUMENTATION = "documentation"
    SUMMARIZER = "summarizer"
    CONVO_STARTER = "convo_starter"
    MULTI_AGENT = "multi_agent"  # For complex queries requiring multiple agents
    DIRECT_RESPONSE = "direct_response"  # For simple queries


@dataclass
class TriageDependencies:
    """Dependencies for triage agent - following Pydantic AI best practices"""

    repository_name: str
    user_context: Dict[str, Any]
    conversation_history: Optional[List[Dict[str, Any]]] = None
    available_agents: List[AgentType] = None

    def __post_init__(self):
        if self.available_agents is None:
            self.available_agents = list(AgentType)


class TriageResult(BaseModel):
    """Result from triage agent with routing decision"""

    decision: TriageDecision
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)
    recommended_agents: List[AgentType] = Field(default_factory=list)
    context_for_agents: Dict[str, Any] = Field(default_factory=dict)
    direct_response: Optional[str] = None  # For simple queries


class TriageAgent:
    """
    Triage Agent that routes queries to appropriate specialist agents

    This agent uses the existing UniversalAgentFactory and MCP tools to make
    intelligent routing decisions while maintaining DRY principles.
    """

    def __init__(self):
        self.factory = universal_factory

        # Create triage agent following official Pydantic AI patterns
        mcp_server = self.factory.custom_mcp.get_mcp_server()
        mcp_servers = [mcp_server] if mcp_server else []

        self.agent = Agent(
            model="openai:gpt-4o-mini",
            deps_type=TriageDependencies,
            output_type=TriageResult,
            system_prompt=self._get_system_prompt(),
            mcp_servers=mcp_servers,  # Include MCP server only if available
        )

        # Register tools for agent communication
        self._register_tools()

    def _get_system_prompt(self) -> str:
        """Generate system prompt for triage agent"""
        return """
You are an intelligent triage agent that routes user queries to appropriate specialist agents.

Your role is to analyze incoming queries and determine the best agent(s) to handle them.

Available specialist agents:
- SIMPLIFIER: Code simplification, DRY analysis, refactoring recommendations
- TESTER: Test generation, test execution, coverage analysis
- DOCUMENTATION: Technical documentation, API docs, architecture overviews
- SUMMARIZER: Context summarization, information distillation
- CONVO_STARTER: Conversation flow guidance, next steps recommendations

Available MCP Tools (use these to understand the codebase):
- mcp_shriram-prod-108_search_code: Search for code patterns
- mcp_shriram-prod-108_find_entities: Discover functions, classes, files
- mcp_shriram-prod-108_get_entity_relationships: Map dependencies
- mcp_shriram-prod-108_qa_codebase: Get comprehensive insights

Decision Guidelines:
1. For code quality/refactoring queries → SIMPLIFIER
2. For testing-related queries → TESTER
3. For documentation needs → DOCUMENTATION
4. For summarization tasks → SUMMARIZER
5. For conversation guidance → CONVO_STARTER
6. For complex queries → MULTI_AGENT (multiple agents)
7. For simple questions → DIRECT_RESPONSE

Always provide reasoning for your decision and confidence level.
Use MCP tools to understand the codebase context when making routing decisions.
"""

    def _register_tools(self):
        """Register tools for agent communication"""

        @self.agent.tool
        async def route_to_simplifier(
            ctx: RunContext[TriageDependencies],
            query: str,
            context: Optional[Dict[str, Any]] = None,
        ) -> str:
            """Route query to simplifier agent"""
            return await self._execute_specialist_agent(
                ctx, AgentType.SIMPLIFIER, query, context
            )

        @self.agent.tool
        async def route_to_tester(
            ctx: RunContext[TriageDependencies],
            query: str,
            context: Optional[Dict[str, Any]] = None,
        ) -> str:
            """Route query to tester agent"""
            return await self._execute_specialist_agent(
                ctx, AgentType.TESTER, query, context
            )

        @self.agent.tool
        async def route_to_documentation(
            ctx: RunContext[TriageDependencies],
            query: str,
            context: Optional[Dict[str, Any]] = None,
        ) -> str:
            """Route query to documentation agent"""
            return await self._execute_specialist_agent(
                ctx, AgentType.DOCUMENTATION, query, context
            )

        @self.agent.tool
        async def route_to_summarizer(
            ctx: RunContext[TriageDependencies],
            query: str,
            context: Optional[Dict[str, Any]] = None,
        ) -> str:
            """Route query to summarizer agent"""
            return await self._execute_specialist_agent(
                ctx, AgentType.SUMMARIZER, query, context
            )

        @self.agent.tool
        async def route_to_convo_starter(
            ctx: RunContext[TriageDependencies],
            query: str,
            context: Optional[Dict[str, Any]] = None,
        ) -> str:
            """Route query to conversation starter agent"""
            return await self._execute_specialist_agent(
                ctx, AgentType.CONVO_STARTER, query, context
            )

        @self.agent.tool
        async def execute_multi_agent_workflow(
            ctx: RunContext[TriageDependencies],
            query: str,
            agent_types: List[AgentType],
            context: Optional[Dict[str, Any]] = None,
        ) -> str:
            """Execute multiple agents in sequence or parallel"""
            results = []
            combined_context = {**(context or {}), **ctx.deps.user_context}

            for agent_type in agent_types:
                try:
                    result = await self._execute_specialist_agent(
                        ctx, agent_type, query, combined_context
                    )
                    results.append(f"{agent_type.value}: {result}")

                    # Add result to context for next agent
                    combined_context[f"{agent_type.value}_result"] = result

                except Exception as e:
                    logger.error(f"Error executing {agent_type}: {e}")
                    results.append(f"{agent_type.value}: Error - {str(e)}")

            return "\n\n".join(results)

    async def _execute_specialist_agent(
        self,
        ctx: RunContext[TriageDependencies],
        agent_type: AgentType,
        query: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Execute a specialist agent using the universal factory"""
        try:
            # Merge contexts
            combined_context = {
                **ctx.deps.user_context,
                **(context or {}),
                "triage_decision": True,
                "original_query": query,
            }

            # Execute using existing universal factory
            result = await self.factory.execute_agent(
                agent_type=agent_type,
                repository_name=ctx.deps.repository_name,
                user_query=query,
                context=combined_context,
            )

            return result.content

        except Exception as e:
            logger.error(f"Error executing {agent_type} agent: {e}")
            return f"Error executing {agent_type} agent: {str(e)}"

    async def triage_and_execute(
        self,
        repository_name: str,
        user_query: str,
        user_context: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Main triage method that analyzes query and executes appropriate agent(s)
        Following official Pydantic AI MCP patterns

        Returns:
            Dictionary containing triage decision and results
        """
        session_key = f"triage_{uuid.uuid4().hex[:8]}"

        try:
            # Get or create unique MCP session for this triage execution
            mcp_server = await self.factory.custom_mcp.get_or_create_session(
                session_key
            )

            # Create triage agent with unique session
            triage_agent = self.factory.create_agent_with_session(
                AgentType.DOCUMENTATION, mcp_server
            )  # Use any type for now

            # Prepare dependencies
            deps = TriageDependencies(
                repository_name=repository_name,
                user_context=user_context or {},
                conversation_history=conversation_history,
            )

            # Run triage analysis following official MCP pattern
            logger.info(
                f"Running triage analysis with MCP tools (session: {session_key})"
            )
            if mcp_server:
                async with triage_agent.run_mcp_servers():
                    triage_result = await triage_agent.run(user_query, deps=deps)
                    triage_data = triage_result.data
            else:
                # Run without MCP if session creation failed
                logger.warning("Running triage agent without MCP tools")
                triage_result = await triage_agent.run(user_query, deps=deps)
                triage_data = triage_result.data

            # Execute based on triage decision
            if triage_data.decision == TriageDecision.DIRECT_RESPONSE:
                return {
                    "triage_decision": triage_data.decision,
                    "reasoning": triage_data.reasoning,
                    "confidence": triage_data.confidence,
                    "result": triage_data.direct_response,
                    "metadata": {"execution_time": "immediate"},
                }

            elif triage_data.decision == TriageDecision.MULTI_AGENT:
                # Execute multiple agents based on triage recommendations
                results = []
                for agent_type in triage_data.recommended_agents:
                    try:
                        agent_result = await self.factory.execute_agent(
                            agent_type=agent_type,
                            repository_name=repository_name,
                            user_query=user_query,
                            context={
                                "triage_decision": triage_data.decision,
                                "triage_reasoning": triage_data.reasoning,
                                **triage_data.context_for_agents,
                            },
                        )
                        results.append(
                            {
                                "agent_type": agent_type.value,
                                "result": agent_result.content,
                                "confidence": agent_result.confidence,
                                "metadata": agent_result.metadata,
                            }
                        )
                    except Exception as e:
                        logger.error(f"Error executing {agent_type} agent: {e}")
                        results.append(
                            {
                                "agent_type": agent_type.value,
                                "result": f"Error: {str(e)}",
                                "confidence": 0.0,
                                "metadata": {"error": True},
                            }
                        )

                return {
                    "triage_decision": triage_data.decision,
                    "reasoning": triage_data.reasoning,
                    "confidence": triage_data.confidence,
                    "results": results,
                    "metadata": {"agents_executed": len(results)},
                }

            else:
                # Single agent execution
                agent_type = AgentType(triage_data.decision.value)
                agent_result = await self.factory.execute_agent(
                    agent_type=agent_type,
                    repository_name=repository_name,
                    user_query=user_query,
                    context={
                        "triage_decision": triage_data.decision,
                        "triage_reasoning": triage_data.reasoning,
                        **triage_data.context_for_agents,
                    },
                )

                return {
                    "triage_decision": triage_data.decision,
                    "reasoning": triage_data.reasoning,
                    "confidence": triage_data.confidence,
                    "result": agent_result.content,
                    "metadata": {
                        "agent_confidence": agent_result.confidence,
                        "agent_metadata": agent_result.metadata,
                    },
                }

        except Exception as e:
            logger.error(f"Triage and execution failed: {e}")
            return {
                "triage_decision": "error",
                "reasoning": f"Triage system error: {str(e)}",
                "confidence": 0.0,
                "result": "Sorry, I encountered an error while analyzing your request. Please try again.",
                "metadata": {"error": True, "error_type": type(e).__name__},
            }
        finally:
            # Clean up session after triage execution
            await self.factory.custom_mcp.cleanup_session(session_key)


# Global triage agent instance
triage_agent = TriageAgent()
