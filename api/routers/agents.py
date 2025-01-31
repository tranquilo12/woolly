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
from typing import List, Optional
from ..utils.database import get_db
from ..utils.models import Agent, AgentCreate, AgentUpdate, AgentResponse, Message
from datetime import datetime, timezone
import uuid

router = APIRouter()


# region Agent CRUD
@router.post("/agents", response_model=AgentResponse)
async def create_agent(agent: AgentCreate, db: Session = Depends(get_db)):
    db_agent = Agent(
        name=agent.name,
        description=agent.description,
        system_prompt=agent.system_prompt,
        tools=agent.tools,
    )
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)

    # Convert UUID to string in response
    return AgentResponse(
        id=str(db_agent.id),
        name=db_agent.name,
        description=db_agent.description,
        system_prompt=db_agent.system_prompt,
        tools=db_agent.tools,
        created_at=db_agent.created_at,
        is_active=db_agent.is_active,
    )


@router.get("/agents", response_model=List[AgentResponse])
async def list_agents(db: Session = Depends(get_db)):
    return db.query(Agent).filter(Agent.is_active == True).all()


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


async def stream_response(request: DocumentationRequest, db: Session):
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
                                if delta:  # Only yield if there's new content
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
                    )

                    if result.usage:
                        yield f"e:{json.dumps({'finishReason': 'stop', 'usage': {'promptTokens': result.usage.prompt_tokens, 'completionTokens': result.usage.completion_tokens}})}\n"
                    else:
                        yield f"e:{json.dumps({'finishReason': 'stop', 'usage': {'promptTokens': 0, 'completionTokens': 0}})}\n"

    except Exception as e:
        logging.error(f"Stream error: {e}")
        yield f"e:{json.dumps({'finishReason': 'error', 'usage': {'promptTokens': 0, 'completionTokens': 0}})}\n"


async def save_documentation_message(
    chat_id: UUID,
    content: str,
    role: str,
    model: str,
    db: Session,
    agent_id: UUID,
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
        )

        db.add(message)
        db.commit()
        db.refresh(message)

        # Verify message was saved
        saved_message = (
            db.query(Message)
            .filter(Message.id == message.id, Message.agent_id == agent_id)
            .first()
        )

        if not saved_message:
            raise Exception("Message not saved correctly")

        return message
    except Exception as e:
        db.rollback()
        logging.error(f"Error saving message: {str(e)}")
        raise


# endregion


@router.post("/agents/{agent_id}/documentation")
async def generate_documentation(
    agent_id: UUID,
    request: DocumentationRequest,
    db: Session = Depends(get_db),
):
    # Save initial user message if it exists
    if request.messages and request.messages[-1]["role"] == "user":
        await save_documentation_message(
            chat_id=request.chat_id,
            content=request.messages[-1]["content"],
            role="user",
            model=request.model,
            db=db,
            agent_id=agent_id,
        )

    response = StreamingResponse(
        stream_response(request, db),
        headers={"x-vercel-ai-data-stream": "v1"},
    )

    return response
