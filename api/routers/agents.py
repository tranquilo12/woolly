import json
import logging
from functools import wraps
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..utils.database import get_db
from ..utils.models import (
    Agent,
    AgentCreate,
    AgentResponse,
    AgentUpdate,
    Message,
)

# Router Setup
router = APIRouter()
logger = logging.getLogger(__name__)


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


# Health check endpoint - MUST be before parameterized routes
@router.get("/agents/health")
async def health_check():
    """Redirect to unified health endpoint."""
    return {
        "status": "moved",
        "message": "Use unified health endpoint at /api/v2/health",
        "endpoint": "/api/v2/health",
    }


# Core Agent CRUD Operations
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
            tools=(
                agent.tools
                if isinstance(agent.tools, list)
                else (json.loads(agent.tools) if agent.tools else [])
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
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    for field, value in agent_update.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)

    db.commit()
    db.refresh(agent)
    return agent


@router.delete("/agents/{agent_id}", response_model=AgentResponse)
async def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    db.delete(agent)
    db.commit()
    return agent


# Essential utility function for saving agent messages
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
    """Save agent message to database with proper error handling"""
    try:
        message = Message(
            chat_id=chat_id,
            role=role,
            content=content,
            model=model,
            agent_id=agent_id,
            repository_name=repository,
            message_type=message_type,
            tool_invocations=tool_invocations or [],
            pipeline_id=pipeline_id,
            iteration_index=iteration_index,
            step_index=step_index,
            step_title=step_title,
        )

        db.add(message)
        db.commit()
        db.refresh(message)

        logger.info(f"Saved agent message: {message.id}")
        return message

    except Exception as e:
        logger.error(f"Error saving agent message: {e}")
        db.rollback()
        raise


# Backward compatibility endpoint - decommissioned
@router.post("/generate/{specialization}")
async def generate_documentation_compatibility(
    specialization: str,
    request: dict,
    db: Session = Depends(get_db),
):
    """410 Gone - legacy endpoint removed. Use unified agent system instead."""
    raise HTTPException(
        status_code=410,
        detail={
            "error": "Endpoint deprecated",
            "message": "Use /api/v2/agents/execute instead",
            "migration_guide": "/docs/api/endpoints-analysis.md",
        },
    )
