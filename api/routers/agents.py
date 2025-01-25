import asyncio
import datetime
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator, List, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from httpx import AsyncClient
from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, Field
from pydantic_ai import RunContext
from pydantic_ai.agent import Agent as PydanticAgent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.result import StreamedRunResult
from pydantic_ai.messages import ModelResponse, ToolCallPart
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
    build_end_of_stream_message,
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


gpt_4o = OpenAIModel(
    model_name="gpt-4o",
    openai_client=AsyncOpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        # organization=os.getenv("OPENAI_ORG_ID"),
    ),
)

docs_agent = PydanticAgent(
    model=gpt_4o,
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


async def stream_pydantic_response(
    stream: AsyncIterator[StreamedRunResult],
    db: Session = None,
    message_id: UUID = None,
) -> AsyncIterator[str]:
    """Handles Pydantic-AI streaming while maintaining Vercel protocol compatibility"""
    content_buffer = ""
    tool_invocations = []

    try:
        async for chunk in stream.stream():
            yield chunk
            # try:
            #     for part in chunk.parts:
            #         if isinstance(part, TextPart):
            #             content_buffer += part.content
            #             yield f"0:{json.dumps(part.content)}\n"
            #         elif hasattr(part, "tool_calls"):
            #             for tool_call in part.tool_calls:
            #                 yield build_tool_call_partial(
            #                     tool_call_id=tool_call.id,
            #                     tool_name=tool_call.name,
            #                     args=tool_call.args,
            #                 )
            #                 if tool_call.result:
            #                     tool_invocations.append(
            #                         {
            #                             "id": tool_call.id,
            #                             "toolName": tool_call.name,
            #                             "args": tool_call.args,
            #                             "result": tool_call.result,
            #                             "state": "result",
            #                         }
            #                     )
            #                     yield build_tool_call_result(
            #                         tool_call_id=tool_call.id,
            #                         tool_name=tool_call.name,
            #                         args=tool_call.args,
            #                         result=tool_call.result,
            #                     )
            # except (httpx.ReadError, asyncio.CancelledError) as e:
            #     # Break the loop if client disconnects
            #     print(f"There's a bunch of things wrong here: {e}")
            #     break

        # Only send end message if we haven't broken the loop
        # yield 'e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0,"totalTokens":0},"isContinued":false}\n'
    except Exception as e:
        print(f"Error in stream: {str(e)}")
        yield f'e:{{"finishReason":"error","error":"{str(e)}","isContinued":false}}\n'
    finally:
        # Always try to save the message if we have content
        if db and message_id and content_buffer:
            try:
                message = db.query(Message).filter(Message.id == message_id).first()
                if message:
                    message.content = content_buffer
                    message.tool_invocations = tool_invocations
                    db.commit()
            except Exception as e:
                print(f"Failed to update message: {e}")


class DocumentationRequest(BaseModel):
    repo_name: str


@router.post("/agents/{agent_id}/documentation")
async def generate_documentation(
    agent_id: str,
    request: DocumentationRequest,
    db: Session = Depends(get_db),
):
    async def stream_response():
        async with get_http_client() as client:
            client.timeout = httpx.Timeout(30.0, connect=60.0)

            deps = RepoContentRequest(
                repo_name=request.repo_name,
                db=db,
                client=client,
                limit=10,
                threshold=0.3,
            )

            user_prompt = f"Here's the entire context for generating the documentation for my project: {request.repo_name}"

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
                                    if isinstance(part, ToolCallPart):
                                        # Try to parse JSON, but don't fail if it's partial
                                        try:
                                            args = json.loads(part.args.args_json)
                                        except json.JSONDecodeError:
                                            # If JSON is incomplete, send as partial content
                                            yield build_tool_call_partial(
                                                tool_call_id=part.tool_call_id,
                                                tool_name=part.tool_name,
                                                args=part.args.args_json,  # Send raw string
                                            )
                                            continue

                                        # If JSON parsed successfully, send complete content
                                        yield build_tool_call_partial(
                                            tool_call_id=part.tool_call_id,
                                            tool_name=part.tool_name,
                                            args=args,
                                        )

                                        # Only send result if we have complete JSON
                                        if "content" in args:
                                            result_data = {
                                                "content": args.get("content", ""),
                                                "success": True,
                                                "metadata": {
                                                    "model": message.model_name,
                                                    "timestamp": message.timestamp.isoformat(),
                                                    "kind": message.kind,
                                                },
                                            }

                                            yield build_tool_call_result(
                                                tool_call_id=part.tool_call_id,
                                                tool_name=part.tool_name,
                                                args=args,
                                                result=result_data,
                                            )

                        except Exception as e:
                            print(f"Error processing message: {e}")
                            continue

                    # Send finish message when complete
                    if last:
                        yield build_end_of_stream_message(
                            finish_reason="stop",
                            prompt_tokens=0,
                            completion_tokens=0,
                            is_continued=False,
                        )

            except (httpx.ReadError, asyncio.CancelledError) as e:
                print(f"Stream interrupted: {e}")
                yield build_end_of_stream_message(
                    finish_reason="error",
                    prompt_tokens=0,
                    completion_tokens=0,
                    is_continued=False,
                )

            except Exception as e:
                print(f"Error in stream: {str(e)}")
                yield build_end_of_stream_message(
                    finish_reason="error",
                    prompt_tokens=0,
                    completion_tokens=0,
                    is_continued=False,
                )
                raise HTTPException(status_code=500, detail=str(e))

    return StreamingResponse(
        stream_response(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Transfer-Encoding": "chunked",
            "Access-Control-Allow-Origin": "*",
            "x-vercel-ai-data-stream": "v1",
        },
    )


# endregion
