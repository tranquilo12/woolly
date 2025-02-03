import json
import logging
import os
from pathlib import Path
from httpx import AsyncClient
from uuid import UUID
from fastapi.responses import StreamingResponse
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai import Agent as PydanticAgent, RunContext
from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from pydantic_ai.models.openai import ModelResponse, TextPart
from pydantic import ConfigDict, Field, BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, AsyncGenerator

from ..utils.database import get_db
from ..utils.models import Agent, AgentCreate, AgentUpdate, AgentResponse, Message
from datetime import datetime, timezone
import uuid
from sqlalchemy.exc import IntegrityError

router = APIRouter()


# region Agent CRUD
@router.post("/agents", response_model=AgentResponse)
async def create_agent(
    agent: AgentCreate,
    db: Session = Depends(get_db),
):
    try:
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

        # Parse the JSON string back to a list for the response
        tools_list = json.loads(db_agent.tools)

        return AgentResponse(
            id=str(db_agent.id),
            name=db_agent.name,
            description=db_agent.description,
            system_prompt=db_agent.system_prompt,
            tools=tools_list,  # Pass the parsed list instead of JSON string
            created_at=db_agent.created_at,
            is_active=db_agent.is_active,
            repository=db_agent.repository,
        )
    except IntegrityError as e:
        db.rollback()
        # Check if it's a unique constraint violation
        if "agents_name_key" in str(e):
            raise HTTPException(
                status_code=409, detail="An agent with this name already exists"
            )
        raise
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to process tools data")


@router.get("/agents", response_model=List[AgentResponse])
async def list_agents(db: Session = Depends(get_db)):
    agents = db.query(Agent).filter(Agent.is_active == True).all()

    # Convert each agent's tools from JSON string to list
    return [
        AgentResponse(
            id=str(agent.id),
            name=agent.name,
            description=agent.description,
            system_prompt=agent.system_prompt,
            tools=json.loads(agent.tools),
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


# region Agent Operations Types
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


# region Agents
gpt_4o_mini = OpenAIModel(
    model_name="gpt-4o-mini",
    openai_client=AsyncOpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
    ),
)

docs_agent = PydanticAgent(
    model=gpt_4o_mini,
    deps_type=CodeSearch,
    result_type=SearchResponse,
    system_prompt=Path("api/docs_system_prompt.txt").read_text(),
)

# endregion


# region Agent Tools
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


# endregion


# region Agent Streaming


# Update the DocumentationRequest model
class DocumentationRequest(BaseModel):
    id: str
    messages: List[dict]
    model: str = "gpt-4o-mini"
    agent_id: UUID
    repo_name: str
    file_paths: Optional[List[str]] = []
    chat_id: UUID  # New field


async def stream_documentation_response(request: DocumentationRequest, db: Session):
    base_prompt = f"Generate documentation for {request.repo_name}"
    if request.messages:
        user_messages = [
            message["content"]
            for message in request.messages
            if message["role"] == "user"
        ]
        if user_messages:
            user_prompt = f"{base_prompt}\n\nHere is some additional context:\n\n{'\n\n'.join(user_messages)}"
        else:
            user_prompt = base_prompt
    else:
        user_prompt = base_prompt

    code_search_query = CodeSearch(
        query="*",
        repo_name=request.repo_name,
    )

    last_content = ""  # Track the last content we've seen
    try:
        async with docs_agent.run_stream(
            user_prompt=user_prompt, result_type=str, deps=code_search_query
        ) as result:
            async for message, last in result.stream_structured(debounce_by=0.01):
                try:
                    if isinstance(message, ModelResponse) and message.parts:
                        for part in message.parts:
                            if isinstance(part, TextPart):
                                # Calculate the delta from the last content
                                current_content = part.content
                                delta = current_content[len(last_content) :]
                                if delta:
                                    yield f"0:{json.dumps(delta)}\n"
                                    last_content = current_content

                except Exception as e:
                    logging.error(f"Error processing message: {e}")
                    continue

                if last:
                    # Save the complete message
                    complete_content = "\n".join(
                        [part.content for part in message.parts]
                    )
                    await save_documentation_message(
                        chat_id=request.chat_id,
                        content=complete_content,
                        role="assistant",
                        model=request.model,
                        db=db,
                        agent_id=request.agent_id,
                        repository=request.repo_name,
                        message_type="documentation",
                    )

                    # Fix: Get usage stats safely
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
        logging.error(f"Stream error: {e}")
        yield f"e:{json.dumps({'finishReason': 'error', 'usage': {'promptTokens': 0, 'completionTokens': 0, 'totalTokens': 0}})}\n"


async def save_documentation_message(
    chat_id: UUID,
    content: str,
    role: str,
    model: str,
    db: Session,
    agent_id: UUID,
    repository: str,
    message_type: str,
) -> Message:
    """Save documentation message to database"""
    try:
        message = Message(
            id=uuid.uuid4(),
            chat_id=chat_id,
            content=content,
            role=role,
            model=model,
            created_at=datetime.now(timezone.utc),
            tool_invocations=[],
            agent_id=agent_id,
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
                Message.agent_id == agent_id,
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


@router.post("/agents/{agent_id}/documentation")
async def generate_documentation(
    agent_id: UUID,
    request: DocumentationRequest,
    db: Session = Depends(get_db),
):
    response = StreamingResponse(
        stream_documentation_response(request, db),
        headers={"x-vercel-ai-data-stream": "v1"},
    )
    return response


# endregion


# region Mermaid


class MermaidRequest(BaseModel):
    id: str  # chat_id
    repository: str
    content: Optional[str] = None
    messages: Optional[List[dict]] = []
    agent_id: Optional[UUID] = None


mermaid_agent = PydanticAgent(
    model=gpt_4o_mini,
    deps_type=CodeSearch,
    result_type=str,
    system_prompt=Path("api/mermaid_system_prompt.txt").read_text(),
)


async def save_mermaid_message(
    chat_id: UUID,
    content: str,
    role: str,
    model: str,
    db: Session,
    agent_id: UUID,
    repository: str,
    message_type: str,
) -> Message:
    """Save mermaid message to database"""
    try:
        message = Message(
            id=uuid.uuid4(),
            chat_id=chat_id,
            content=content,
            role=role,
            model=model,
            created_at=datetime.now(timezone.utc),
            tool_invocations=[],
            agent_id=agent_id,
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
                Message.agent_id == agent_id,
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
                    await save_mermaid_message(
                        chat_id=request.id,
                        content=complete_content,
                        role="assistant",
                        model="gpt-4o-mini",
                        db=db,
                        agent_id=request.agent_id,
                        repository=request.repository,
                        message_type="mermaid",
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
        agent = db.query(Agent).filter(Agent.id == str(agent_id)).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        # Return streaming response
        response = StreamingResponse(
            stream_mermaid_response(request, db),
            headers={"x-vercel-ai-data-stream": "v1"},
        )
        return response

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# Add new model for messages
class MessageCreate(BaseModel):
    chat_id: str
    agent_id: str  # Change from UUID to str to match database schema
    repository: str
    message_type: str  # 'documentation' or 'mermaid'
    role: str
    content: str


@router.post("/agents/{agent_id}/messages")
async def save_message(
    agent_id: UUID,
    message: MessageCreate,
    db: Session = Depends(get_db),
):
    try:
        # Create a new message with proper ID
        db_message = Message(
            id=uuid.uuid4(),  # Add explicit ID
            chat_id=message.chat_id,
            agent_id=str(agent_id),  # Convert UUID to string
            repository=message.repository,
            message_type=message.message_type,
            role=message.role,
            content=message.content,
            created_at=datetime.now(timezone.utc),  # Add timestamp
        )
        db.add(db_message)
        db.commit()
        return {"status": "success", "message_id": str(db_message.id)}
    except Exception as e:
        db.rollback()
        logging.error(f"Failed to save message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agents/{agent_id}/messages")
async def get_messages(
    agent_id: UUID,
    chat_id: str,
    repository: str,
    message_type: str,
    db: Session = Depends(get_db),
):
    messages = (
        db.query(Message)
        .filter(
            Message.agent_id == str(agent_id),
            Message.chat_id == chat_id,
            Message.repository == repository,
            Message.message_type == message_type,
        )
        .order_by(Message.created_at.asc())
        .all()
    )
    return messages


# endregion
