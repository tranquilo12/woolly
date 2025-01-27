import asyncio
import datetime
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional
from uuid import UUID
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from httpx import AsyncClient
from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, Field
from pydantic_ai import RunContext
from pydantic_ai.agent import Agent as PydanticAgent
from pydantic_ai.messages import ModelResponse, TextPart, ToolCallPart
from pydantic_ai.models.openai import OpenAIModel
from sqlalchemy.orm import Session

from ..services.stream_service import get_streaming_headers
from ..utils.database import get_db
from ..utils.models import Agent, AgentCreate, AgentResponse, AgentUpdate
from ..utils.stream_utils import (
    format_content,
    format_tool_partial,
    format_tool_result,
    format_end_message,
)

router = APIRouter()


@asynccontextmanager
async def get_http_client():
    async with AsyncClient() as client:
        yield client


# region CRUD Operations for Agents
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
    return db_agent


@router.get("/agents", response_model=List[AgentResponse])
async def list_agents(db: Session = Depends(get_db)):
    return db.query(Agent).all()


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


# region Agent Operations
# Updated CodeSearchQuery Model
class CodeSearchQuery(BaseModel):
    """Model for code search queries with repo_name and request generation."""

    repo_name: str
    query: str
    limit: int = Field(default=10, ge=1, le=100)
    threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    file_paths: Optional[List[str]] = None
    chunk_types: Optional[List[str]] = None

    def model_dump(self, *args, **kwargs) -> dict:
        """Override model_dump to exclude the generate_request method"""
        data = super().model_dump(*args, **kwargs)
        if "generate_request" in data:
            del data["generate_request"]
        return data

    def generate_request(self) -> dict:
        """Generate request dictionary for HTTP client."""
        return {
            "url": f"http://localhost:7779/indexer/{self.repo_name}/search",
        }


class CodeSearchResult(BaseModel):
    """Model for individual code search results."""

    content: str
    chunk_type: str
    file_path: str
    start_point: List[int]
    end_point: List[int]
    score: float
    repository: str


class CodeSearchResponse(BaseModel):
    """Model for code search response with improved string representation."""

    results: List[CodeSearchResult]
    total_found: int
    query_time_ms: float

    def __str__(self):
        """Generate a human-readable representation of the response."""
        result_summary = []
        for result in self.results:  # Show all results
            code_lines = result.content.split("\n")
            formatted_code = "\n        ".join(code_lines)  # Indent code blocks

            result_summary.append(
                f"File: {result.file_path}\n"
                f"    Score: {result.score:.2f}\n"
                f"    Code:\n"
                f"        {formatted_code}"
            )

        summary = "\n\n".join(result_summary)

        return (
            f"Total Found: {self.total_found}\n"
            f"Query Time: {self.query_time_ms:.2f} ms\n"
            f"\nResults:\n\n{summary}"
        )


class RepoContentRequest(BaseModel):
    """The content sent from the user to the tool"""

    repo_name: str
    file_paths: Optional[List[str]] = None
    db: Session
    client: AsyncClient
    limit: int = 10
    threshold: Optional[float] = 0.3
    model_config = ConfigDict(arbitrary_types_allowed=True)


class RepoFormattedReturn(BaseModel):
    """The content sent BY THE AGENT as the result"""

    content: str = Field(description="The formatted documentation content")
    tool_name: Optional[str] = Field(
        default=None, description="Name of the tool being called"
    )
    tool_call_id: Optional[str] = Field(default=None, description="ID of the tool call")
    args_json: Optional[str] = Field(
        default=None, description="JSON string containing the arguments"
    )
    part_kind: Optional[str] = Field(
        default=None, description="Kind of part (e.g., 'tool-call')"
    )
    model_name: Optional[str] = Field(
        default=None, description="Name of the model used"
    )
    timestamp: Optional[datetime.datetime] = Field(
        default=None, description="Timestamp of the response"
    )
    kind: Optional[str] = Field(default=None, description="Kind of response")

    @classmethod
    def from_model_response(cls, response):
        """Create RepoFormattedReturn from a ModelResponse"""
        # First get the top-level metadata
        base_data = {
            "model_name": getattr(response, "model_name", None),
            "timestamp": getattr(response, "timestamp", None),
            "kind": getattr(response, "kind", None),
        }

        if hasattr(response, "parts") and response.parts:
            for part in response.parts:
                # Get tool call metadata from the part
                tool_data = {
                    "tool_name": getattr(part, "tool_name", None),
                    "tool_call_id": getattr(part, "tool_call_id", None),
                    "part_kind": getattr(part, "part_kind", None),
                }

                # Get content from args_json
                if hasattr(part, "args") and hasattr(part.args, "args_json"):
                    try:
                        args_data = json.loads(part.args.args_json)
                        content = args_data.get("content", "")

                        # Combine all data
                        return cls(
                            content=content,
                            args_json=part.args.args_json,
                            **tool_data,
                            **base_data,
                        )
                    except json.JSONDecodeError:
                        continue
        return None

    class Config:
        json_schema_extra = {
            "example": {
                "content": "# Project Documentation\n\n## Overview\n...",
                "tool_name": "final_result",
                "tool_call_id": "call_xyz",
                "args_json": '{"content": "..."}',
                "part_kind": "tool-call",
                "model_name": "gpt-4o",
                "timestamp": "2025-01-25T19:03:15+00:00",
                "kind": "response",
            }
        }


gpt_4o_mini = OpenAIModel(
    model_name="gpt-4o-mini",
    openai_client=AsyncOpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
    ),
)

docs_agent = PydanticAgent(
    model=gpt_4o_mini,
    deps_type=RepoContentRequest,
    result_type=RepoFormattedReturn,
    system_prompt=Path("api/docs_system_prompt.txt").read_text(),
)


@docs_agent.tool
async def fetch_repo_content(
    ctx: RunContext[RepoContentRequest], repo_name: str
) -> str:
    """Fetch repository content from the indexing service"""
    try:
        code_search_query = CodeSearchQuery(
            query="*",
            repo_name=repo_name,
            limit=ctx.deps.limit if ctx.deps.limit else 10,
            threshold=ctx.deps.threshold if ctx.deps.threshold else 0.3,
        )

        # Get the URL from the request
        url = code_search_query.generate_request()["url"]

        # Send the request with proper JSON payload
        response = await ctx.deps.client.post(
            url=url, json=code_search_query.model_dump(exclude={"generate_request"})
        )

        # Check for error response
        if response.status_code != 200:
            error_data = response.json()
            error_msg = error_data.get("detail", "Unknown error occurred")
            return f"Error fetching repository content: {error_msg}"

        # Parse successful response
        response_data = response.json()
        # print(f"Response data: {response_data}")
        data = CodeSearchResponse(**response_data)
        return str(data)

    except Exception as e:
        print(f"Error in fetch_repo_content: {str(e)}")
        return f"Error processing repository content: {str(e)}"


# Update the DocumentationRequest model
class DocumentationRequest(BaseModel):
    id: str
    messages: List[dict]
    model: str = "gpt-4o-mini"
    agent_id: UUID
    repo_name: str
    file_paths: Optional[List[str]] = []


@router.post("/agents/{agent_id}/documentation")
async def generate_documentation(
    agent_id: UUID,
    request: DocumentationRequest,
    db: Session = Depends(get_db),
):
    """Generate documentation for a repository"""

    async def stream_response():
        async with get_http_client() as client:
            client.timeout = httpx.Timeout(30.0, connect=60.0)

            deps = RepoContentRequest(
                repo_name=request.repo_name,
                file_paths=request.file_paths,
                db=db,
                client=client,
                limit=10,
                threshold=0.3,
            )

            user_prompt = f"Generate documentation for {request.repo_name}"

            try:
                async with docs_agent.run_stream(
                    user_prompt=user_prompt, deps=deps, result_type=RepoFormattedReturn
                ) as result:
                    async for message, last in result.stream_structured(
                        debounce_by=0.01
                    ):
                        try:
                            if isinstance(message, ModelResponse) and message.parts:
                                for part in message.parts:
                                    if isinstance(part, TextPart):
                                        yield format_content(part.content)
                                    elif isinstance(part, ToolCallPart):
                                        # Extract tool call information
                                        tool_args = json.loads(part.args_as_json_str())
                                        yield format_tool_partial(
                                            tool_call_id=part.tool_call_id
                                            or str(uuid.uuid4()),
                                            tool_name=part.tool_name or "unknown",
                                            args=tool_args,
                                        )

                        except Exception as e:
                            print(f"Error processing message: {e}")
                            continue

                        if last:
                            yield format_end_message(
                                finish_reason="stop",
                                prompt_tokens=0,
                                completion_tokens=0,
                            )

            except Exception as e:
                print(f"Stream error: {e}")
                yield format_end_message(
                    finish_reason="error", prompt_tokens=0, completion_tokens=0
                )

        yield StreamingResponse(stream_response(), headers=get_streaming_headers())


# endregion
