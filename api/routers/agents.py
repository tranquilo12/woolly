import uuid
from fastapi import APIRouter, Depends, HTTPException, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, AsyncIterator, Union
from dataclasses import dataclass
from pydantic_ai import Agent, RunContext, ModelResponse, TextPart
import json
from uuid import UUID

from ..utils.database import get_db
from ..utils.models import (
    Agent,
    Message,
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    DocumentationChatHistory,
    build_tool_call_partial,
    build_tool_call_result,
)

router = APIRouter()


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


# region Agent Operations


@dataclass
class DocumentationDependencies:
    repo_name: str
    file_paths: Optional[List[str]]
    db: Session


documentation_agent = Agent(
    "openai:gpt-4o",
    deps_type=DocumentationDependencies,
    result_type=DocumentationChatHistory,
    system_prompt=(
        "You are a documentation assistant. Generate comprehensive documentation "
        "for the provided repository and files."
    ),
)


@documentation_agent.system_prompt
async def setup_documentation_context(
    ctx: RunContext[DocumentationDependencies],
) -> str:
    return (
        f"Analyzing repository: {ctx.deps.repo_name}\n"
        f"Files to document: {', '.join(ctx.deps.file_paths) if ctx.deps.file_paths else 'all files'}"
    )


async def stream_pydantic_response(
    stream: AsyncIterator[Union[str, ModelResponse]],
    db: Session = None,
    message_id: UUID = None,
) -> AsyncIterator[str]:
    """Handles Pydantic-AI streaming while maintaining Vercel protocol compatibility"""
    content_buffer = ""
    tool_invocations = []

    async for chunk in stream:
        if isinstance(chunk, ModelResponse):
            for part in chunk.parts:
                if isinstance(part, TextPart):
                    content_buffer += part.content
                    yield f"0:{json.dumps(part.content)}\n"
                elif hasattr(part, "tool_calls"):
                    for tool_call in part.tool_calls:
                        yield build_tool_call_partial(
                            tool_call_id=tool_call.id,
                            tool_name=tool_call.name,
                            args=tool_call.args,
                        )
                        if tool_call.result:
                            tool_invocations.append(
                                {
                                    "id": tool_call.id,
                                    "toolName": tool_call.name,
                                    "args": tool_call.args,
                                    "result": tool_call.result,
                                    "state": "result",
                                }
                            )
                            yield build_tool_call_result(
                                tool_call_id=tool_call.id,
                                tool_name=tool_call.name,
                                args=tool_call.args,
                                result=tool_call.result,
                            )

    # End of stream message in Vercel format
    yield 'e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0,"totalTokens":0},"isContinued":false}\n'

    if db and message_id:
        try:
            message = db.query(Message).filter(Message.id == message_id).first()
            if message:
                message.content = content_buffer
                message.tool_invocations = tool_invocations
                db.commit()
        except Exception as e:
            print(f"Failed to update message: {e}")


@router.post("/agents/{agent_id}/documentation")
async def generate_documentation(
    agent_id: str,
    repo_name: str,
    file_paths: Optional[List[str]] = None,
    db: Session = Depends(get_db),
):
    deps = DocumentationDependencies(repo_name=repo_name, file_paths=file_paths, db=db)
    message_id = uuid.uuid4()

    # Run the Pydantic-AI agent with streaming
    async with documentation_agent.run_stream(
        f"Create documentation for repository {repo_name}", deps=deps, max_steps=5
    ) as stream:
        return StreamingResponse(
            stream_pydantic_response(
                stream=stream,
                db=db,
                message_id=message_id,
            ),
            media_type="text/event-stream",
            headers={
                "x-vercel-ai-data-stream": "v1",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )


# endregion
