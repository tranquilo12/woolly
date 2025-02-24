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
from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, Field
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
from ..documentation.strategies import strategy_registry
from ..utils.openai_client import get_openai_client

# region Router Setup
router = APIRouter()

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
        return {
            "url": f"http://localhost:7779/indexer/{self.repo_name}/search",
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


class DocumentationResult(BaseModel):
    """Combined documentation result"""

    system_overview: Optional[SystemOverview] = None
    component_analysis: Optional[List[ComponentAnalysis]] = None
    code_documentation: Optional[List[CodeDocumentation]] = None
    development_guide: Optional[DevelopmentGuide] = None
    maintenance_ops: Optional[MaintenanceOps] = None


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


# endregion


# region Agent Configuration
gpt_4o_mini = OpenAIModel(
    model_name="gpt-4o-mini",
    openai_client=get_openai_client(async_client=True),
)

docs_agent = PydanticAgent(
    model=gpt_4o_mini,
    deps_type=CodeSearch,
    result_type=Dict[str, Any],
    system_prompt=Path("api/docs_system_prompt.txt").read_text(),
)

# Define specialized agents
system_overview_agent = PydanticAgent(
    model=gpt_4o_mini,
    deps_type=CodeSearch,
    result_type=SystemOverview,
    system_prompt="""You are a software architecture expert focused on creating high-level system overviews.
    Analyze the codebase and generate a comprehensive system overview including:
    - Architecture diagrams in mermaid format
    - Core technologies and their relationships
    - Key design patterns used
    - System requirements
    - Project structure explanation
    Be precise and technical in your analysis.""",
)

component_analysis_agent = PydanticAgent(
    model=gpt_4o_mini,
    deps_type=CodeSearch,
    result_type=ComponentAnalysis,
    system_prompt="""You are a component analysis specialist.
    Your task is to deeply analyze individual components by:
    - Identifying component purposes and responsibilities
    - Mapping dependencies and relationships
    - Creating component relationship diagrams
    - Documenting technical implementation details
    - Identifying integration points
    Focus on practical, implementation-level details.""",
)

code_documentation_agent = PydanticAgent(
    model=gpt_4o_mini,
    deps_type=CodeSearch,
    result_type=CodeDocumentation,
    system_prompt="""You are a code documentation expert.
    Your role is to:
    - Document key code modules and their purposes
    - Identify and explain important patterns
    - Create clear usage examples
    - Document APIs and interfaces
    Focus on helping developers understand how to use and maintain the code.""",
)

development_guide_agent = PydanticAgent(
    model=gpt_4o_mini,
    deps_type=CodeSearch,
    result_type=DevelopmentGuide,
    system_prompt="""You are a development workflow specialist.
    Create comprehensive development guides including:
    - Development environment setup
    - Workflow procedures and best practices
    - Coding guidelines and standards
    Make the documentation practical and actionable.""",
)

maintenance_ops_agent = PydanticAgent(
    model=gpt_4o_mini,
    deps_type=CodeSearch,
    result_type=MaintenanceOps,
    system_prompt="""You are a DevOps and maintenance specialist.
    Document operational aspects including:
    - Maintenance procedures and schedules
    - Troubleshooting guides
    - Operational considerations
    - Monitoring and alerting
    Focus on keeping the system running smoothly.""",
)


# Map steps to agents
def get_step_agents(strategy_name: str):
    """Get strategy-specific agents with proper system prompts"""
    strategy = strategy_registry[strategy_name]
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
    tool_invocations: List = None,
) -> Message:
    """Unified function to save any type of agent message"""
    try:
        # Convert agent_id to string for consistency
        agent_id_str = str(agent_id)

        # Verify agent exists
        agent = db.query(Agent).filter(Agent.id == agent_id_str).first()
        if not agent:
            raise Exception(f"Agent {agent_id_str} not found")

        # Convert tool_invocations to list of dicts if it's a string
        if isinstance(tool_invocations, str):
            try:
                tool_invocations = json.loads(tool_invocations)
            except json.JSONDecodeError:
                tool_invocations = []

        message = Message(
            id=uuid.uuid4(),
            chat_id=chat_id,
            content=content,
            role=role,
            model=model,
            created_at=datetime.now(timezone.utc),
            tool_invocations=tool_invocations or [],
            agent_id=agent_id_str,  # Use string version
            repository=repository,
            message_type=message_type,
        )

        db.add(message)
        db.commit()
        db.refresh(message)

        # Verify message was saved
        saved_message = (
            db.query(Message)
            .filter(
                Message.id == message.id,
                Message.agent_id == agent_id_str,  # Use string version
                Message.repository == repository,
                Message.message_type == message_type,
            )
            .first()
        )

        if not saved_message:
            raise Exception("Message not saved correctly")

        return message
    except Exception as e:
        db.rollback()
        logging.error(f"Error saving message: {str(e)}")
        raise


async def process_documentation_step(
    step: int,
    context: DocumentationContext,
    repo_name: str,
    code_search_query: CodeSearch,
    prompt: str,
    strategy: str = "basic",
) -> AsyncGenerator[str, None]:
    """Process a documentation step using specialized agents with handoff"""
    try:
        # Get the strategy-specific agents
        step_agents = get_step_agents(strategy)
        step_config = step_agents.get(step)
        if not step_config:
            raise ValueError(f"No agent found for step {step} in strategy {strategy}")

        step_agent, model_class = step_config
        print(f"Step agent: {step_agent}")
        print(f"Model class: {model_class}")

        # Get strategy details
        strategy_details = strategy_registry.get(strategy)
        if not strategy_details:
            raise ValueError(f"Strategy {strategy} not found")

        # Generate context key from step model name
        current_step = next((s for s in strategy_details.steps if s.id == step), None)
        if not current_step:
            raise ValueError(f"Step {step} not found in strategy {strategy}")

        context_key = current_step.model.lower()  # Use model name as context key

        # Construct a more specific prompt that includes the user's intent and previous context
        enhanced_prompt = f"""For repository {repo_name}, {prompt}\n\nPrevious documentation context:\n\n {json.dumps(context.partial_results, indent=2)}\n\nFocus on generating documentation for the current step ({context_key}). \n\n Your response should be a complete, well-structured JSON object matching the schema for this step"""

        async with step_agent.run_stream(
            user_prompt=enhanced_prompt,
            deps=code_search_query,
            result_type=model_class,
        ) as result:
            content_buffer = []
            last_content = ""

            # For draft tool calls
            dtc = []

            # Index of the current draft tool call
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
                                    # print(f"\n\n----- dtc:\n\n{dtc}\n\n -----")
                                    # print(
                                    #     f"\n\n----- arguments:\n\n{arguments}\n\n -----"
                                    # )
                                    dtc[i_dtc]["arguments"] = arguments

                                    if is_complete_json(arguments):
                                        parsed_args = json.loads(arguments)
                                        context.partial_results[context_key] = (
                                            parsed_args
                                        )
                                        # First send the "call" state
                                        yield build_tool_call_partial(
                                            tool_call_id=tool_call_id,
                                            tool_name=tool_name,
                                            args=parsed_args,
                                        )

                                        # Then execute and send the result
                                        try:
                                            if tool_name in available_tools:
                                                tool_result = available_tools[
                                                    tool_name
                                                ](**parsed_args)
                                            else:
                                                tool_result = None

                                            yield build_tool_call_result(
                                                tool_call_id=tool_call_id,
                                                tool_name=tool_name,
                                                args=parsed_args,
                                                result=tool_result,
                                            )
                                        except Exception as e:
                                            yield build_tool_call_result(
                                                tool_call_id=tool_call_id,
                                                tool_name=tool_name,
                                                args=parsed_args,
                                                result={"error": str(e)},
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

                            # Update completion message to use dynamic context key
                            completion_message = {
                                "finishReason": "step_complete",
                                "usage": usage_data,
                                "state": "result",
                                "context": {
                                    context_key: complete_content,
                                    "step": step,
                                },
                            }

                            yield f"e:{json.dumps(completion_message)}\n"

    except Exception as e:
        logging.error(f"Error in process_documentation_step: {e}")
        yield f"e:{json.dumps({'error': str(e)})}\n"


async def stream_documentation_response(request: DocumentationRequest, db: Session):
    """Stream documentation generation with step-based approach"""
    try:
        # Initialize or get existing context
        context = request.context or DocumentationContext()

        # Ensure step is properly set
        step = request.step if request.step is not None else context.current_step
        if step < 1 or step > 5:  # Validate step range
            raise ValueError(f"Invalid step number: {step}")

        code_search_query = CodeSearch(
            query="*",
            repo_name=request.repo_name,
        )

        # Process current step
        async for content in process_documentation_step(
            step,  # Use validated step number
            context,
            request.repo_name,
            code_search_query,
            request.prompt or "",
            request.strategy,
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
    result_type=str,
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
            user_prompt = f"{base_prompt}\n\nHere is some additional context:\n\n{'\n\n'.join(user_messages)}"

    code_search_query = CodeSearch(
        query="*",
        repo_name=request.repository,
    )

    last_content = ""  # Track the last content we've seen
    try:
        async with mermaid_agent.run_stream(
            user_prompt=user_prompt,
            result_type=str,
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
    agent_id: str  # Change from UUID to str to match database schema
    repository: str
    message_type: str  # 'documentation' or 'mermaid'
    role: str
    content: str
    tool_invocations: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


@router.get("/agents/{agent_id}/messages")
async def get_messages(
    agent_id: UUID,
    chat_id: str,
    repository: str,
    message_type: str,
    db: Session = Depends(get_db),
):
    try:
        # Convert UUIDs to strings for consistency
        agent_id_str = str(agent_id)
        chat_id_uuid = UUID(chat_id)

        logging.info(
            f"Fetching agent messages with params: agent_id={agent_id_str}, chat_id={chat_id}, repository={repository}, message_type={message_type}"
        )

        # Verify agent exists
        agent = db.query(Agent).filter(Agent.id == agent_id_str).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        # Ensure we only get messages for this specific agent and message type
        messages = (
            db.query(Message)
            .filter(
                Message.agent_id == agent_id_str,  # Use string version
                Message.chat_id == chat_id_uuid,  # Use UUID
                Message.repository == repository,
                Message.message_type == message_type,
                Message.agent_id.isnot(None),  # Ensure we only get agent messages
            )
            .order_by(Message.created_at.asc())
            .all()
        )

        logging.info(f"Found {len(messages)} agent messages")

        # Standardize tool invocations for each message
        for message in messages:
            if message.tool_invocations:
                message.tool_invocations = standardize_tool_invocations(
                    message.tool_invocations
                )
            else:
                message.tool_invocations = []

        return messages
    except ValueError as e:
        logging.error(f"Invalid UUID format for chat_id: {chat_id}")
        raise HTTPException(status_code=400, detail=f"Invalid chat_id format: {str(e)}")
    except Exception as e:
        logging.error(f"Error fetching agent messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/{agent_id}/messages")
async def save_message(
    agent_id: UUID,
    message: MessageCreate,
    db: Session = Depends(get_db),
):
    """Save a message for an agent"""
    try:
        # Convert agent_id to string for consistency
        agent_id_str = str(agent_id)

        # Verify agent exists
        agent = db.query(Agent).filter(Agent.id == agent_id_str).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        # Verify this is an agent message
        if not message.message_type or not message.agent_id:
            raise HTTPException(
                status_code=400,
                detail="Invalid agent message: missing message_type or agent_id",
            )

        # Standardize tool invocations to match index.py format
        tool_invocations = standardize_tool_invocations(message.tool_invocations or [])

        # Create a new message with proper ID and tool invocations
        db_message = Message(
            id=uuid.uuid4(),  # Add explicit ID
            chat_id=message.chat_id,
            agent_id=agent_id_str,  # Use string version
            repository=message.repository,
            message_type=message.message_type,
            role=message.role,
            content=message.content,
            tool_invocations=tool_invocations,  # Now properly standardized
            created_at=datetime.now(timezone.utc),
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)

        # Verify the message was saved
        saved_message = (
            db.query(Message)
            .filter(
                Message.id == db_message.id,
                Message.agent_id == agent_id_str,
                Message.message_type == message.message_type,
            )
            .first()
        )

        if not saved_message:
            raise HTTPException(status_code=500, detail="Message failed to save")

        return {"status": "success", "message_id": str(db_message.id)}
    except Exception as e:
        db.rollback()
        logging.error(f"Failed to save agent message: {e}")
        print(f"Failed to save agent message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
