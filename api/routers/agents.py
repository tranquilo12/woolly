from fastapi import APIRouter, Depends, HTTPException, StreamingResponse
from sqlalchemy import UUID
from sqlalchemy.orm import Session
from typing import List, Optional
from ..utils.database import get_db
from ..utils.models import (
    Agent,
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    DocumentationSystemMessage,
    DocumentationUserMessage,
    DocumentationChatHistory,
)
from pydantic_ai import ChatHistory, SystemMessage, UserMessage, AssistantMessage

router = APIRouter()


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


@router.post("/agents/{agent_id}/documentation")
async def generate_documentation(
    agent_id: UUID,
    repo_name: str,
    file_paths: Optional[List[str]] = None,
    db: Session = Depends(get_db),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    system_msg = DocumentationSystemMessage(
        content=agent.system_prompt, repo_name=repo_name, file_paths=file_paths
    )

    user_msg = DocumentationUserMessage(
        content=f"Create a documentation plan for {repo_name}", repo_name=repo_name
    )

    chat_history = DocumentationChatHistory(
        messages=[system_msg, user_msg], repo_name=repo_name
    )

    return StreamingResponse(
        stream_text(chat_history.messages, "data", db=db),
        headers={"x-vercel-ai-data-stream": "v1"},
    )
