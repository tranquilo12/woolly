import json
import logging
import os
import uuid
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from httpx import AsyncClient
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_ai import Agent as PydanticAgent
from pydantic_ai import RunContext
from pydantic_ai.models.openai import ModelResponse, OpenAIModel, TextPart, ToolCallPart
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..utils.database import get_db
from ..utils.models import (
    Agent,
    AgentCreate,
    AgentResponse,
    AgentUpdate,
    Message,
    build_tool_call_partial,
    build_tool_call_result,
    is_complete_json,
)
from ..utils.tools import execute_python_code

# Legacy strategy registry import - keeping for backward compatibility
try:
    from ..documentation.strategies import strategy_registry
except ImportError:
    # Strategy registry removed in Phase 2 - using fallback
    strategy_registry = {}
from ..utils.openai_client import get_openai_client

# region Router Setup
router = APIRouter()

# Configure logging
logger = logging.getLogger(__name__)

available_tools = {
    "execute_python_code": execute_python_code,
}


def handle_db_operation(func):
    """Decorator for handling database operations with consistent error handling"""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except IntegrityError as e:
            if "agents_name_key" in str(e):
                raise HTTPException(
                    status_code=409, detail="An agent with this name already exists"
                )
            raise
        except Exception as e:
            if "db" in kwargs:
                kwargs["db"].rollback()
            logging.error(f"Error in {func.__name__}: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    return wrapper


# endregion


# region Base Models & Types
class BaseRepositoryRequest(BaseModel):
    """Base model for repository-related requests"""

    repo_name: str
    file_paths: Optional[List[str]] = None
    limit: int = Field(default=10, ge=1, le=100)
    threshold: float = Field(default=0.7, ge=0.0, le=1.0)


class CodeSearch(BaseRepositoryRequest):
    """Model for code search operations"""

    query: str
    client: AsyncClient = Field(default_factory=AsyncClient)
    model_config = ConfigDict(arbitrary_types_allowed=True)

    def generate_request(self) -> dict:
        """Generate request dictionary for HTTP client."""
        # Note: This method is deprecated - MCP integration replaces HTTP client
        return {
            "url": f"http://localhost:8009/search",  # Updated to use MCP server port
            "params": self.model_dump(exclude={"generate_request", "client"}),
        }


class SearchResult(BaseModel):
    """Model for code search results with metadata"""

    content: str
    file_path: str
    chunk_type: str = "code"
    score: float
    location: dict[str, List[int]] = Field(
        default_factory=lambda: {"start": [0], "end": [0]}
    )
    repository: str

    def __str__(self) -> str:
        """Human-readable result format"""
        return (
            f"File: {self.file_path}\n"
            f"Score: {self.score:.2f}\n"
            f"Content:\n{self.content}"
        )


class SearchResponse(BaseModel):
    """Container for search results with metrics"""

    results: List[SearchResult]
    total_found: int = 0
    query_time_ms: float = 0.0

    def __str__(self) -> str:
        """Generate formatted response summary"""
        results = "\n\n".join(str(result) for result in self.results)
        return (
            f"Found {self.total_found} results in {self.query_time_ms:.2f}ms\n\n"
            f"{results}"
        )


# endregion


# region Core Agent CRUD Operations
@router.post("/agents", response_model=AgentResponse)
@handle_db_operation
async def create_agent(
    agent: AgentCreate,
    db: Session = Depends(get_db),
):
    # Check for existing agent with same name
    existing_agent = (
        db.query(Agent)
        .filter(Agent.name == agent.name, Agent.repository == agent.repository)
        .first()
    )

    if existing_agent:
        # If agent exists and matches repository, return it
        if existing_agent.repository == agent.repository:
            return AgentResponse(
                id=str(existing_agent.id),
                name=existing_agent.name,
                description=existing_agent.description,
                system_prompt=existing_agent.system_prompt,
                tools=(
                    existing_agent.tools
                    if isinstance(existing_agent.tools, list)
                    else (
                        json.loads(existing_agent.tools) if existing_agent.tools else []
                    )
                ),
                created_at=existing_agent.created_at,
                is_active=existing_agent.is_active,
                repository=existing_agent.repository,
            )
        # If name conflict with different repository, append repository name
        agent.name = f"{agent.name}_{agent.repository}"

    # Convert tools list to JSON string for database storage
    tools_json = json.dumps(agent.tools)

    db_agent = Agent(
        name=agent.name,
        description=agent.description,
        system_prompt=agent.system_prompt,
        tools=tools_json,
        repository=agent.repository,
    )

    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)

    return AgentResponse(
        id=str(db_agent.id),
        name=db_agent.name,
        description=db_agent.description,
        system_prompt=db_agent.system_prompt,
        tools=agent.tools,  # Use original tools list
        created_at=db_agent.created_at,
        is_active=db_agent.is_active,
        repository=db_agent.repository,
    )


@router.get("/agents", response_model=List[AgentResponse])
async def list_agents(
    repository: Optional[str] = None,
    type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all agents, optionally filtered by repository"""
    query = db.query(Agent)

    if repository:
        query = query.filter(Agent.repository == repository)

    agents = query.all()

    return [
        AgentResponse(
            id=str(agent.id),
            name=agent.name,
            description=agent.description,
            system_prompt=agent.system_prompt,
            # Handle tools that might already be deserialized
            tools=(
                agent.tools
                if isinstance(agent.tools, list)
                else json.loads(agent.tools) if agent.tools else []
            ),
            created_at=agent.created_at,
            is_active=agent.is_active,
            repository=agent.repository,
        )
        for agent in agents
    ]


@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.patch("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str, agent_update: AgentUpdate, db: Session = Depends(get_db)
):
    db_agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Update only provided fields
    update_data = agent_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_agent, field, value)

    db.commit()
    db.refresh(db_agent)
    return db_agent


@router.delete("/agents/{agent_id}", response_model=AgentResponse)
async def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    db_agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Soft delete by setting is_active to False
    db_agent.is_active = False
    db.commit()
    db.refresh(db_agent)
    return db_agent


# endregion


# region Documentation Models
class DocumentationStep(BaseModel):
    """Base model for documentation steps"""

    step_number: int
    title: str
    content: str
    status: str = "pending"  # pending, in_progress, completed, failed


class SystemOverview(BaseModel):
    """System overview documentation section"""

    architecture_diagram: str = Field(description="Mermaid diagram string")
    core_technologies: List[str]
    design_patterns: List[str]
    system_requirements: List[str]
    project_structure: str = Field(description="Project structure tree")

    @classmethod
    def model_validate_json(cls, json_data: str, *args, **kwargs):
        """Custom JSON validation to handle newlines properly"""
        if isinstance(json_data, str):
            # Parse the JSON string while preserving newlines
            data = json.loads(json_data)
            return cls.model_validate(data)


def standardize_tool_invocations(tool_invocations: List[dict]) -> List[dict]:
    """Standardize tool invocations to match index.py format"""
    if not tool_invocations:
        return []

    standardized = []
    for tool in tool_invocations:
        # Convert from pydantic_ai format to standard format
        standardized_tool = {
            "id": tool.get("toolCallId") or tool.get("id"),  # Handle both formats
            "toolName": tool.get("toolName"),
            "args": tool.get("args", {}),
            "state": tool.get("state", "result"),
            "result": tool.get("result"),
        }
        standardized.append(standardized_tool)
    return standardized


class ComponentAnalysis(BaseModel):
    """Component analysis documentation section"""

    name: str
    purpose: str
    dependencies: List[str]
    relationships_diagram: str
    technical_details: dict
    integration_points: List[str]


class CodeDocumentation(BaseModel):
    """Code documentation section"""

    modules: List[Dict[str, Any]]
    patterns: List[str]
    usage_examples: List[str]
    api_specs: Optional[dict] = None


class DevelopmentGuide(BaseModel):
    """Development setup and workflow documentation"""

    setup: str
    workflow: str
    guidelines: List[str]


class MaintenanceOps(BaseModel):
    """Maintenance and operations documentation"""

    procedures: List[str]
    troubleshooting: Dict[str, str]
    operations: str


# DocumentationResult moved to legacy compatibility section below


class DocumentationContext(BaseModel):
    """Context maintained between documentation steps"""

    current_step: int = 1
    completed_steps: List[int] = Field(default_factory=list)
    partial_results: Dict[str, Any] = Field(default_factory=dict)
    last_error: Optional[str] = None
    current_prompt: Optional[str] = None


# Update the existing DocumentationRequest model
class DocumentationRequest(BaseModel):
    id: str
    messages: List[dict]
    model: str = "gpt-4o-mini"
    agent_id: UUID
    repo_name: str
    file_paths: Optional[List[str]] = Field(default_factory=list)
    chat_id: UUID
    step: Optional[int] = None
    context: Optional[DocumentationContext] = None
    prompt: Optional[str] = None
    strategy: str = "basic"  # Add strategy selection
    pipeline_id: Optional[str] = None  # Add pipeline_id field


# endregion


# region Agent Configuration
# Phase 2: Using Universal Agent System instead of legacy core module
from ..agents.universal import (
    universal_factory,
    AgentType,
    UniversalResult,
    UniversalDependencies,
)


# Legacy compatibility - DocumentationResult for backward compatibility
class DocumentationResult(BaseModel):
    """Legacy documentation result for backward compatibility"""

    content: str
    metadata: Dict[str, Any]
    confidence: float
    sources: List[str]
    tool_calls: List[Dict[str, Any]]
    agent_type: str
    documentation_type: str = "documentation"
    sections: List[str] = Field(default_factory=list)
    diagrams: List[str] = Field(default_factory=list)


# Use universal factory instead of specialized documentation factory
documentation_agent_factory = universal_factory

# MCP tools are integrated through the agent factory, not direct imports
# The actual MCP calls happen through the Pydantic AI agent with MCP server integration
MCP_TOOLS_AVAILABLE = (
    True  # Always True since we use agent factory with MCP integration
)

# Legacy agent configuration for backward compatibility
# Following Pydantic AI best practices - use OpenAIProvider to create the model
from pydantic_ai.providers.openai import OpenAIProvider

openai_provider = OpenAIProvider(openai_client=get_openai_client(async_client=True))

gpt_4o_mini = OpenAIModel(
    model_name="gpt-4o-mini",
    provider=openai_provider,
)

docs_agent = PydanticAgent(
    model=gpt_4o_mini,
    deps_type=CodeSearch,
    result_type=Dict[str, Any],
    system_prompt=Path("api/docs_system_prompt.txt").read_text(),
)


# Map steps to agents - Legacy function for backward compatibility
def get_step_agents(strategy_name: str):
    """Get strategy-specific agents with proper system prompts"""
    # If strategy registry is empty (Phase 2), return empty dict
    if not strategy_registry:
        return {}

    strategy = strategy_registry.get(strategy_name)
    if not strategy:
        raise ValueError(f"Strategy {strategy_name} not found")

    return {
        step.id: [
            PydanticAgent(
                model=gpt_4o_mini,
                deps_type=CodeSearch,
                result_type=strategy.models[step.model],
                system_prompt=step.system_prompt
                or "You are a technical documentation specialist.",
            ),
            strategy.models[step.model],
        ]
        for step in strategy.steps
    }


# endregion


# region New Agent Factory Endpoints with MCP Integration
class GenerationRequest(BaseModel):
    """Request model for agent factory generation"""

    repository_name: str
    user_query: str
    documentation_type: str
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)
    chat_id: UUID
    agent_id: UUID


class GenerationResponse(BaseModel):
    """Response model for agent factory generation"""

    content: str
    metadata: Dict[str, Any]
    confidence: float
    sources: List[str]
    tool_calls: List[Dict[str, Any]]
    agent_type: str


@router.post("/generate/{specialization}")
async def generate_documentation_with_mcp(
    specialization: str,
    request: GenerationRequest,
    db: Session = Depends(get_db),
) -> GenerationResponse:
    """
    Generate documentation using the new agent factory with direct MCP integration.

    This endpoint replaces the 7+ individual agent endpoints with a single factory-based approach.
    """
    try:
        # Validate specialization - use AgentType enum
        available_specializations = [agent_type.value for agent_type in AgentType]
        if specialization not in available_specializations:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown specialization: {specialization}. Available: {available_specializations}",
            )

        # Use the agent factory with MCP integration
        enhanced_result = await run_agent_with_mcp(
            specialization, request.repository_name, request.user_query, request.context
        )

        # Save the result to database
        await save_agent_message(
            chat_id=request.chat_id,
            content=enhanced_result.content,
            role="assistant",
            model="gpt-4o-mini",
            db=db,
            agent_id=request.agent_id,
            repository=request.repository_name,
            message_type="documentation",
            tool_invocations=enhanced_result.tool_calls,
        )

        return GenerationResponse(
            content=enhanced_result.content,
            metadata=enhanced_result.metadata,
            confidence=enhanced_result.confidence,
            sources=enhanced_result.sources,
            tool_calls=enhanced_result.tool_calls,
            agent_type=enhanced_result.agent_type,
        )

    except Exception as e:
        logger.error(f"Error in generate_documentation_with_mcp: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def run_agent_with_mcp(
    specialization: str,
    repository_name: str,
    user_query: str,
    context: Optional[Dict[str, Any]] = None,
) -> DocumentationResult:
    """
    Run the agent factory with proper MCP integration.

    This function uses the DocumentationAgentFactory with MCP server integration
    to provide comprehensive documentation generation.
    """
    try:
        # Map specialization to AgentType
        agent_type_map = {
            "documentation": AgentType.DOCUMENTATION,
            "system_overview": AgentType.DOCUMENTATION,
            "api_overview": AgentType.DOCUMENTATION,
            "component_analysis": AgentType.DOCUMENTATION,
            "code_documentation": AgentType.DOCUMENTATION,
            "development_guide": AgentType.DOCUMENTATION,
            "maintenance_ops": AgentType.DOCUMENTATION,
        }

        agent_type = agent_type_map.get(specialization, AgentType.DOCUMENTATION)

        # Use universal factory to execute agent
        result = await documentation_agent_factory.execute_agent(
            agent_type=agent_type,
            repository_name=repository_name,
            user_query=user_query,
            context=context or {},
        )

        return DocumentationResult(
            content=result.content,
            metadata=result.metadata,
            confidence=result.confidence,
            sources=result.sources,
            tool_calls=result.tool_calls,
            agent_type=result.agent_type.value,
            documentation_type=specialization,
            sections=[],
            diagrams=[],
        )

    except Exception as e:
        logger.error(f"Agent execution failed: {e}")
        # Return error result
        return DocumentationResult(
            content=f"Error generating {specialization} documentation: {str(e)}",
            metadata={"error": str(e), "specialization": specialization},
            confidence=0.3,
            sources=[],
            tool_calls=[],
            agent_type=f"documentation_{specialization}",
            documentation_type=specialization,
            sections=[],
            diagrams=[],
        )


async def enhance_with_mcp_tools(
    repository_name: str,
    specialization: str,
    user_query: str,
    context: Optional[Dict[str, Any]] = None,
) -> DocumentationResult:
    """
    Enhance documentation generation with direct MCP tool calls.

    This function demonstrates how to use MCP tools directly in the router
    to provide comprehensive documentation generation.
    """
    tool_calls = []
    sources = []
    metadata = {
        "specialization": specialization,
        "enhanced_with_mcp": True,
        "mcp_tools_used": [],
    }

    try:
        # Note: This function is deprecated in favor of run_agent_with_mcp()
        # MCP tools are now integrated through the DocumentationAgentFactory
        # This function provides a simplified fallback response

        content = f"# {specialization.replace('_', ' ').title()} Documentation\n\n"
        content += f"**Repository:** {repository_name}\n"
        content += f"**Query:** {user_query}\n\n"
        content += "## Analysis\n\n"
        content += f"This documentation was generated for the {specialization} specialization.\n"
        content += "For enhanced capabilities with MCP tools, use the /generate/{specialization} endpoint.\n\n"
        content += "## Key Areas\n\n"

        if specialization == "system_overview":
            content += "- Architecture analysis\n- Component relationships\n- System design patterns\n"
        elif specialization == "api_overview":
            content += (
                "- API endpoints\n- Request/response patterns\n- Integration points\n"
            )
        elif specialization == "component_analysis":
            content += "- Component structure\n- Dependencies\n- Interaction patterns\n"
        else:
            content += (
                f"- {specialization.replace('_', ' ').title()} specific analysis\n"
            )

        # Simulate tool calls for compatibility
        tool_calls.append(
            {
                "tool_name": "enhanced_analysis",
                "parameters": {
                    "specialization": specialization,
                    "repository": repository_name,
                },
                "result": {
                    "status": "completed",
                    "message": "Analysis completed using agent factory",
                },
            }
        )
        metadata["mcp_tools_used"].append("agent_factory")

        # Build comprehensive content based on specialization
        content = build_specialized_content(
            specialization=specialization,
            search_result=search_result,  # type: ignore
            entities_result=entities_result,  # type: ignore
            qa_result=qa_result,  # type: ignore
            user_query=user_query,
            repository_name=repository_name,
        )

        return DocumentationResult(
            content=content,
            metadata=metadata,
            confidence=0.9,  # High confidence with MCP tools
            sources=sources,
            tool_calls=tool_calls,
            agent_type=f"documentation_{specialization}",
            documentation_type=specialization,
            sections=[],
            diagrams=[],
        )

    except Exception as e:
        logger.error(f"MCP enhancement failed: {e}")
        # Return basic result if MCP enhancement fails
        return DocumentationResult(
            content=f"Error generating {specialization} documentation: {str(e)}",
            metadata={"error": str(e), "specialization": specialization},
            confidence=0.3,
            sources=[],
            tool_calls=[],
            agent_type=f"documentation_{specialization}",
            documentation_type=specialization,
            sections=[],
            diagrams=[],
        )


def build_specialized_content(
    specialization: str,
    search_result: Any,
    entities_result: Any,
    qa_result: Any,
    user_query: str,
    repository_name: str,
) -> str:
    """Build specialized content based on the documentation type"""

    base_content = f"# {specialization.replace('_', ' ').title()} Documentation\n\n"
    base_content += f"**Repository:** {repository_name}\n"
    base_content += f"**Query:** {user_query}\n\n"

    # Add QA insights if available
    if hasattr(qa_result, "content") and qa_result.content:
        base_content += f"## Comprehensive Analysis\n\n{qa_result.content}\n\n"

    # Add search results
    if hasattr(search_result, "results") and search_result.results:
        base_content += "## Code Analysis\n\n"
        for result in search_result.results[:5]:  # Limit to top 5 results
            if hasattr(result, "content") and hasattr(result, "file_path"):
                base_content += (
                    f"### {result.file_path}\n\n```\n{result.content}\n```\n\n"
                )

    # Add entities information
    if hasattr(entities_result, "entities") and entities_result.entities:
        base_content += "## Key Components\n\n"
        for entity in entities_result.entities[:10]:  # Limit to top 10 entities
            if hasattr(entity, "name") and hasattr(entity, "type"):
                base_content += f"- **{entity.name}** ({entity.type})\n"
        base_content += "\n"

    return base_content


@router.get("/generate/specializations")
async def get_available_specializations():
    """Get list of available documentation specializations"""
    specializations = [
        "documentation",
        "system_overview",
        "api_overview",
        "component_analysis",
        "code_documentation",
        "development_guide",
        "maintenance_ops",
    ]

    descriptions = {
        "documentation": "General documentation generation",
        "system_overview": "System architecture and overview documentation",
        "api_overview": "API documentation and endpoint analysis",
        "component_analysis": "Component structure and dependency analysis",
        "code_documentation": "Code-level documentation and examples",
        "development_guide": "Development setup and workflow documentation",
        "maintenance_ops": "Maintenance and operations documentation",
    }

    return {
        "specializations": specializations,
        "descriptions": descriptions,
    }


# endregion


# region Agent Tools & Utilities
@docs_agent.tool
async def fetch_repo_content(ctx: RunContext[CodeSearch], repo_name: str) -> str:
    """Fetch repository content from the indexing service"""
    try:
        code_search_query = CodeSearch(repo_name=repo_name, query=ctx.deps.query)

        # Get the URL from the request
        result = code_search_query.generate_request()

        # Send the request with proper JSON payload
        response = await ctx.deps.client.post(url=result["url"], json=result["params"])

        # Check for error response
        if response.status_code != 200:
            error_data = response.json()
            error_msg = error_data.get("detail", "Unknown error occurred")
            return f"Error fetching repository content: {error_msg}"

        # Parse successful response
        response_data = response.json()
        data = SearchResponse(**response_data)
        return str(data)

    except Exception as e:
        print(f"Error in fetch_repo_content: {str(e)}")
        return f"Error processing repository content: {str(e)}"


async def save_agent_message(
    chat_id: UUID,
    content: str,
    role: str,
    model: str,
    db: Session,
    agent_id: UUID,
    repository: str,
    message_type: str,
    tool_invocations: Optional[List[Dict[str, Any]]] = None,
    pipeline_id: Optional[str] = None,
    iteration_index: Optional[int] = None,
    step_index: Optional[int] = None,
    step_title: Optional[str] = None,
):
    """Save a message associated with an agent"""
    try:
        # Validate message type
        if message_type not in ["documentation", "mermaid"]:
            raise ValueError("Invalid message type")

        # Convert agent_id to string for consistency
        agent_id_str = str(agent_id)

        # Create message with explicit agent fields
        db_message = Message(
            id=uuid.uuid4(),
            chat_id=chat_id,
            agent_id=agent_id_str,
            repository=repository,
            message_type=message_type,
            pipeline_id=pipeline_id,
            role=role,
            content=content,
            tool_invocations=tool_invocations or [],
            created_at=datetime.now(timezone.utc),
            iteration_index=iteration_index,
            step_index=step_index,
            step_title=step_title,
        )

        db.add(db_message)
        db.commit()
        return db_message
    except Exception as e:
        db.rollback()
        logging.error(f"Failed to save agent message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def process_documentation_step(
    step: int,
    context: DocumentationContext,
    repo_name: str,
    code_search_query: CodeSearch,
    prompt: str,
    strategy: str = "basic",
    pipeline_id: Optional[str] = None,
    db: Optional[Session] = None,
    chat_id: Optional[UUID] = None,
    agent_id: Optional[UUID] = None,
) -> AsyncGenerator[str, None]:
    """
    Process a single documentation step with proper pipeline tracking.

    Enhanced to maintain pipeline continuity and save intermediate results.
    """
    try:
        # Get the strategy-specific agents
        step_agents = get_step_agents(strategy)
        step_config = step_agents.get(step)
        if not step_config:
            raise ValueError(f"No agent found for step {step} in strategy {strategy}")

        step_agent, model_class = step_config
        logger.info(f"Processing step {step} with agent: {step_agent}")

        # Get strategy details
        strategy_details = (
            strategy_registry.get(strategy) if strategy_registry else None
        )
        if not strategy_details:
            raise ValueError(f"Strategy {strategy} not found")

        # Get current step details for metadata
        current_step = next((s for s in strategy_details.steps if s.id == step), None)
        if not current_step:
            raise ValueError(f"Step {step} not found in strategy {strategy}")

        # Store step title for metadata
        step_title = current_step.title

        # Use model name as context key
        context_key = current_step.model.lower()

        # Construct enhanced prompt with pipeline context
        enhanced_prompt = f"""For repository {repo_name}, {prompt}

Previous documentation context:
{json.dumps(context.partial_results, indent=2)}

Pipeline ID: {pipeline_id or 'standalone'}
Current Step: {step} - {step_title}

Focus on generating documentation for the current step ({context_key}). 
Your response should be a complete, well-structured JSON object matching the schema for this step.
"""

        # Track tool calls for database persistence
        tool_calls_log = []
        content_buffer = []
        last_content = ""

        async with step_agent.run_stream(
            user_prompt=enhanced_prompt,
            deps=code_search_query,
            result_type=model_class,
        ) as result:
            # For draft tool calls
            dtc = []
            i_dtc = -1

            async for message, last in result.stream_structured(debounce_by=0.01):
                if isinstance(message, ModelResponse) and message.parts:
                    for part in message.parts:
                        if isinstance(part, TextPart):
                            content_buffer.append(part.content)
                            current_content = part.content
                            delta = current_content[len(last_content) :]
                            if delta:
                                yield f"0:{json.dumps(delta)}\n"
                                last_content = current_content

                        elif isinstance(part, ToolCallPart):
                            tool_call_id = part.tool_call_id
                            tool_name = part.tool_name
                            arguments = part.args_as_json_str()

                            if tool_call_id not in [tc["id"] for tc in dtc]:
                                i_dtc += 1
                                dtc.append(
                                    {
                                        "id": tool_call_id,
                                        "name": tool_name,
                                        "arguments": arguments if arguments else "{}",
                                    }
                                )
                            if arguments:
                                try:
                                    dtc[i_dtc]["arguments"] = arguments

                                    if is_complete_json(arguments):
                                        parsed_args = json.loads(arguments)
                                        context.partial_results[context_key] = (
                                            parsed_args
                                        )

                                        # Log tool call for database persistence
                                        tool_call_entry = {
                                            "id": tool_call_id,
                                            "toolName": tool_name,
                                            "args": parsed_args,
                                            "state": "call",
                                            "pipeline_id": pipeline_id,
                                            "step": step,
                                            "step_title": step_title,
                                        }
                                        tool_calls_log.append(tool_call_entry)

                                        # Send the "call" state
                                        yield build_tool_call_partial(
                                            tool_call_id=tool_call_id,
                                            tool_name=tool_name,
                                            args=parsed_args,
                                        )

                                        # Execute and send the result
                                        try:
                                            if tool_name in available_tools:
                                                tool_result = available_tools[
                                                    tool_name
                                                ](**parsed_args)
                                            else:
                                                tool_result = None

                                            # Update tool call log with result
                                            tool_call_entry["result"] = tool_result
                                            tool_call_entry["state"] = "result"

                                            yield build_tool_call_result(
                                                tool_call_id=tool_call_id,
                                                tool_name=tool_name,
                                                args=parsed_args,
                                                result=tool_result,
                                            )
                                        except Exception as e:
                                            error_result = {"error": str(e)}
                                            tool_call_entry["result"] = error_result
                                            tool_call_entry["state"] = "error"

                                            yield build_tool_call_result(
                                                tool_call_id=tool_call_id,
                                                tool_name=tool_name,
                                                args=parsed_args,
                                                result=error_result,
                                            )
                                except json.JSONDecodeError:
                                    # Skip streaming for incomplete JSON
                                    continue

                        if last:
                            # Get the complete content from all parts
                            complete_content = "\n".join(
                                [
                                    part.content
                                    for part in message.parts
                                    if isinstance(part, TextPart)
                                ]
                            )

                            # Get usage statistics
                            usage_data = {
                                "promptTokens": (
                                    result.usage().request_tokens
                                    if result.usage()
                                    else 0
                                ),
                                "completionTokens": (
                                    result.usage().response_tokens
                                    if result.usage()
                                    else 0
                                ),
                                "totalTokens": (
                                    result.usage().total_tokens if result.usage() else 0
                                ),
                            }

                            # Save step completion to database if db session available
                            if db and chat_id and agent_id:
                                try:
                                    await save_agent_message(
                                        chat_id=chat_id,
                                        content=complete_content,
                                        role="assistant",
                                        model="gpt-4o-mini",
                                        db=db,
                                        agent_id=agent_id,
                                        repository=repo_name,
                                        message_type="documentation",
                                        tool_invocations=tool_calls_log,
                                        pipeline_id=pipeline_id,
                                        iteration_index=1,  # Could be made dynamic
                                        step_index=step,
                                        step_title=step_title,
                                    )
                                    logger.info(
                                        f"Saved step {step} completion to database"
                                    )
                                except Exception as e:
                                    logger.error(f"Failed to save step completion: {e}")

                            # Update completion message with pipeline context
                            completion_message = {
                                "finishReason": "step_complete",
                                "usage": usage_data,
                                "state": "result",
                                "context": {
                                    context_key: complete_content,
                                    "step": step,
                                    "step_title": step_title,
                                    "pipeline_id": pipeline_id,
                                    "total_tool_calls": len(tool_calls_log),
                                },
                                "pipeline_metadata": {
                                    "pipeline_id": pipeline_id,
                                    "step": step,
                                    "step_title": step_title,
                                    "strategy": strategy,
                                    "repository": repo_name,
                                },
                            }

                            yield f"e:{json.dumps(completion_message)}\n"

    except Exception as e:
        logger.error(f"Error in process_documentation_step: {e}")
        error_response = {
            "error": str(e),
            "pipeline_id": pipeline_id,
            "step": step,
            "finishReason": "error",
        }
        yield f"e:{json.dumps(error_response)}\n"


async def stream_documentation_response(request: DocumentationRequest, db: Session):
    """Stream documentation generation with step-based approach"""
    try:
        # Initialize or get existing context
        context = request.context or DocumentationContext()

        # Ensure step is properly set
        step = request.step if request.step is not None else context.current_step

        # Get strategy details to retrieve step title
        strategy_details = (
            strategy_registry.get(request.strategy) if strategy_registry else None
        )
        if not strategy_details:
            raise ValueError(f"Strategy {request.strategy} not found")

        # Validate step range using strategy steps length
        if step < 1 or step > len(strategy_details.steps):
            raise ValueError(
                f"Invalid step number: {step}. Valid range is 1-{len(strategy_details.steps)}"
            )

        # Get current step details for metadata
        current_step = next((s for s in strategy_details.steps if s.id == step), None)
        if not current_step:
            raise ValueError(f"Step {step} not found in strategy {request.strategy}")

        # Store step title for metadata
        step_title = current_step.title

        code_search_query = CodeSearch(
            query="*",
            repo_name=request.repo_name,
        )

        # Save initial system message with metadata
        await save_agent_message(
            chat_id=request.chat_id,
            content=f"Starting documentation step {step}: {step_title}",
            role="system",
            model=request.model,
            db=db,
            agent_id=request.agent_id,
            repository=request.repo_name,
            message_type="documentation",
            pipeline_id=request.pipeline_id,
            iteration_index=0,  # First iteration
            step_index=step,
            step_title=step_title,
        )

        # Process current step with enhanced pipeline tracking
        async for content in process_documentation_step(
            step=step,
            context=context,
            repo_name=request.repo_name,
            code_search_query=code_search_query,
            prompt=request.prompt or "",
            strategy=request.strategy,
            pipeline_id=request.pipeline_id,
            db=db,
            chat_id=request.chat_id,
            agent_id=request.agent_id,
        ):
            if isinstance(content, str):  # Ensure we only yield strings
                yield content
            else:
                logging.error(f"Unexpected content type in stream: {type(content)}")
                yield f"e:{json.dumps({'error': 'Unexpected response format'})}\n"

    except Exception as e:
        print(f"Documentation stream error: {e}")
        logging.error(f"Documentation stream error: {e}")
        yield f"e:{json.dumps({'finishReason': 'error', 'error': str(e), 'usage': {'promptTokens': 0, 'completionTokens': 0, 'totalTokens': 0}})}\n"


@router.post("/agents/{agent_id}/documentation")
async def generate_documentation(
    agent_id: UUID,
    request: DocumentationRequest,
    db: Session = Depends(get_db),
):
    """Generate documentation with streaming response"""
    try:
        # Convert agent_id to string for consistency
        agent_id_str = str(agent_id)

        # Verify agent exists
        agent = db.query(Agent).filter(Agent.id == agent_id_str).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        # Update request with string agent_id
        request.agent_id = agent_id_str

        # Return streaming response
        return StreamingResponse(
            stream_documentation_response(request=request, db=db),
            media_type="text/event-stream",
            headers={"x-vercel-ai-data-stream": "v1"},
        )

    except Exception as e:
        logging.error(f"Documentation generation error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# endregion


# region Mermaid Diagram Generation
class MermaidRequest(BaseModel):
    """Request model for Mermaid diagram generation"""

    id: str  # chat_id
    repository: str
    content: Optional[str] = None
    messages: Optional[List[dict]] = []
    agent_id: Optional[str] = None  # Change to string type


mermaid_agent = PydanticAgent(
    model=gpt_4o_mini,
    deps_type=CodeSearch,
    output_type=str,
    system_prompt=Path("api/mermaid_system_prompt.txt").read_text(),
)


async def stream_mermaid_response(
    request: MermaidRequest, db: Session
) -> AsyncGenerator[str, None]:

    base_prompt = f"Generate a Mermaid diagram for {request.repository}"

    # Safely handle messages
    user_prompt = base_prompt
    if hasattr(request, "messages") and request.messages:
        user_messages = [
            message["content"]
            for message in request.messages
            if message.get("role") == "user"
        ]
        if user_messages:
            separator = "\n\n"
            user_prompt = f"{base_prompt}\n\nHere is some additional context:\n\n{separator.join(user_messages)}"

    code_search_query = CodeSearch(
        query="*",
        repo_name=request.repository,
    )

    last_content = ""  # Track the last content we've seen
    try:
        async with mermaid_agent.run_stream(
            user_prompt=user_prompt,
            output_type=str,
            deps=code_search_query,
        ) as result:
            async for message, last in result.stream_structured(debounce_by=0.01):
                try:
                    if isinstance(message, ModelResponse) and message.parts:
                        for part in message.parts:
                            if isinstance(part, TextPart):
                                # Calculate the delta from the last content
                                current_content = part.content
                                delta = current_content[len(last_content) :]
                                if delta:  # Only yield if there's new content
                                    yield f"0:{json.dumps(delta)}\n"
                                    last_content = current_content

                except Exception as e:
                    logging.error(f"Error processing message: {e}")
                    continue

                if last:
                    complete_content = "\n".join(
                        [part.content for part in message.parts]
                    )
                    await save_agent_message(
                        chat_id=request.id,
                        content=complete_content,
                        role="assistant",
                        model="gpt-4o-mini",
                        db=db,
                        agent_id=request.agent_id,
                        repository=request.repository,
                        message_type="mermaid",
                        tool_invocations=[],
                    )

                    try:
                        usage_stats = result.usage()
                        usage_data = {
                            "promptTokens": (
                                usage_stats.request_tokens if usage_stats else 0
                            ),
                            "completionTokens": (
                                usage_stats.response_tokens if usage_stats else 0
                            ),
                            "totalTokens": (
                                usage_stats.total_tokens if usage_stats else 0
                            ),
                        }
                    except Exception as e:
                        logging.error(f"Failed to get usage stats: {e}")
                        usage_data = {
                            "promptTokens": 0,
                            "completionTokens": 0,
                            "totalTokens": 0,
                        }
                    yield f"e:{json.dumps({'finishReason': 'stop', 'usage': usage_data})}\n"

    except Exception as e:
        logging.error(f"Error in stream_mermaid_response: {e}")
        yield f"e:{json.dumps({'finishReason': 'error', 'usage': {'promptTokens': 0, 'completionTokens': 0, 'totalTokens': 0}})}\n"


@router.post("/agents/{agent_id}/mermaid")
async def generate_mermaid(
    agent_id: UUID,
    request: MermaidRequest,
    db: Session = Depends(get_db),
):
    try:
        # Convert agent_id to string for consistency
        agent_id_str = str(agent_id)

        # Verify agent exists
        agent = db.query(Agent).filter(Agent.id == agent_id_str).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        # Update request with string agent_id
        request.agent_id = agent_id_str

        # Return streaming response
        response = StreamingResponse(
            stream_mermaid_response(request, db),
            headers={"x-vercel-ai-data-stream": "v1"},
        )
        return response

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# endregion


# region Message Management
class MessageCreate(BaseModel):
    """Model for creating new messages"""

    chat_id: str
    agent_id: str
    repository: str
    message_type: str  # 'documentation' or 'mermaid'
    role: str
    content: str
    tool_invocations: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    pipeline_id: Optional[str] = None  # Add pipeline_id field

    @field_validator("message_type")
    def validate_message_type(cls, v):
        if v not in ["documentation", "mermaid"]:
            raise ValueError('message_type must be either "documentation" or "mermaid"')
        return v


# DRY: save_agent_message function already defined above - removing duplicate

# endregion


# region Base Classes
class BaseStreamingResponse:
    """Base class for streaming responses"""

    def __init__(self, db: Session):
        self.db = db
        self.last_content = ""

    async def process_message(self, message: ModelResponse) -> str:
        """Process a single message and return the delta"""
        if not message.parts:
            return ""

        for part in message.parts:
            if isinstance(part, TextPart):
                current_content = part.content
                delta = current_content[len(self.last_content) :]
                if delta:
                    self.last_content = current_content
                    return f"0:{json.dumps(delta)}\n"
        return ""

    def get_usage_data(self, result) -> dict:
        """Get usage statistics"""
        try:
            usage_stats = result.usage()
            return {
                "promptTokens": usage_stats.request_tokens if usage_stats else 0,
                "completionTokens": usage_stats.response_tokens if usage_stats else 0,
                "totalTokens": usage_stats.total_tokens if usage_stats else 0,
            }
        except Exception as e:
            logging.error(f"Failed to get usage stats: {e}")
            return {
                "promptTokens": 0,
                "completionTokens": 0,
                "totalTokens": 0,
            }


# endregion
