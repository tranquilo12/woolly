"""
Triage Router - Intelligent Multi-Agent Routing API

This module provides FastAPI endpoints for the triage agent system.
It integrates with the existing universal agent architecture while adding
intelligent routing capabilities.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from uuid import UUID
import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session

from ..agents.triage import triage_agent, TriageDecision
from ..agents.universal import AgentType
from ..utils.database import get_db
from ..routers.agents import save_agent_message

router = APIRouter()
logger = logging.getLogger(__name__)


class TriageRequest(BaseModel):
    """Request model for triage operations"""

    repository_name: str
    user_query: str
    user_context: Dict[str, Any] = Field(default_factory=dict)
    conversation_history: Optional[List[Dict[str, Any]]] = None

    # Optional database fields for message saving
    chat_id: Optional[UUID] = None
    agent_id: Optional[UUID] = None


class TriageResponse(BaseModel):
    """Response model for triage operations"""

    triage_decision: str
    reasoning: str
    confidence: float
    recommended_agents: List[str] = Field(default_factory=list)
    result: str
    execution_time: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class TriageAnalysisRequest(BaseModel):
    """Request model for triage analysis only (no execution)"""

    repository_name: str
    user_query: str
    user_context: Dict[str, Any] = Field(default_factory=dict)
    conversation_history: Optional[List[Dict[str, Any]]] = None


class TriageAnalysisResponse(BaseModel):
    """Response model for triage analysis only"""

    triage_decision: str
    reasoning: str
    confidence: float
    recommended_agents: List[str] = Field(default_factory=list)
    context_for_agents: Dict[str, Any] = Field(default_factory=dict)
    direct_response: Optional[str] = None


@router.post("/triage/analyze", response_model=TriageAnalysisResponse)
async def analyze_query(request: TriageAnalysisRequest) -> TriageAnalysisResponse:
    """
    Analyze a query and return triage decision without executing agents

    This endpoint is useful for understanding what the triage agent would do
    without actually executing the specialist agents.
    """
    try:
        # Use the triage agent's internal agent for analysis only
        from ..agents.triage import TriageDependencies

        deps = TriageDependencies(
            repository_name=request.repository_name,
            user_context=request.user_context,
            conversation_history=request.conversation_history,
        )

        # Run triage analysis
        triage_result = await triage_agent.agent.run(request.user_query, deps=deps)
        triage_data = triage_result.data

        return TriageAnalysisResponse(
            triage_decision=triage_data.decision.value,
            reasoning=triage_data.reasoning,
            confidence=triage_data.confidence,
            recommended_agents=[
                agent.value for agent in triage_data.recommended_agents
            ],
            context_for_agents=triage_data.context_for_agents,
            direct_response=triage_data.direct_response,
        )

    except Exception as e:
        logger.error(f"Triage analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Triage analysis failed: {str(e)}")


@router.post("/triage/execute", response_model=TriageResponse)
async def execute_triage(
    request: TriageRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> TriageResponse:
    """
    Execute triage analysis and run the appropriate specialist agent(s)

    This is the main triage endpoint that:
    1. Analyzes the query to determine the best agent(s)
    2. Executes the chosen agent(s)
    3. Returns the results with triage reasoning
    """
    try:
        start_time = datetime.now()

        # Execute triage and get results
        result = await triage_agent.triage_and_execute(
            repository_name=request.repository_name,
            user_query=request.user_query,
            user_context=request.user_context,
            conversation_history=request.conversation_history,
        )

        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()

        # Save to database if chat_id provided
        if request.chat_id and request.agent_id:
            background_tasks.add_task(
                save_agent_message,
                chat_id=request.chat_id,
                content=result["result"],
                role="assistant",
                model="triage-agent-system",
                db=db,
                agent_id=request.agent_id,
                repository=request.repository_name,
                message_type="triage_result",
                tool_invocations=[
                    {
                        "type": "triage_execution",
                        "decision": result["triage_decision"],
                        "reasoning": result["reasoning"],
                        "confidence": result["confidence"],
                        "recommended_agents": result.get("recommended_agents", []),
                    }
                ],
            )

        return TriageResponse(
            triage_decision=result["triage_decision"],
            reasoning=result["reasoning"],
            confidence=result["confidence"],
            recommended_agents=result.get("recommended_agents", []),
            result=result["result"],
            execution_time=execution_time,
        )

    except Exception as e:
        logger.error(f"Triage execution failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Triage execution failed: {str(e)}"
        )


@router.post("/triage/execute/streaming")
async def execute_triage_streaming(request: TriageRequest):
    """
    Execute triage with streaming response

    This endpoint provides real-time streaming of triage decisions and agent execution.
    """
    try:

        async def generate_triage_stream():
            # First, analyze the query
            yield f"data: {json.dumps({'type': 'analysis_start', 'message': 'Analyzing query...'})}\n\n"

            # Get triage decision
            from ..agents.triage import TriageDependencies

            deps = TriageDependencies(
                repository_name=request.repository_name,
                user_context=request.user_context,
                conversation_history=request.conversation_history,
            )

            triage_result = await triage_agent.agent.run(request.user_query, deps=deps)
            triage_data = triage_result.data

            # Send triage decision
            yield f"data: {json.dumps({
                'type': 'triage_decision',
                'decision': triage_data.decision.value,
                'reasoning': triage_data.reasoning,
                'confidence': triage_data.confidence,
                'recommended_agents': [agent.value for agent in triage_data.recommended_agents]
            })}\n\n"

            # Execute based on decision
            if triage_data.decision == TriageDecision.DIRECT_RESPONSE:
                yield f"data: {json.dumps({
                    'type': 'direct_response',
                    'content': triage_data.direct_response
                })}\n\n"

            else:
                yield f"data: {json.dumps({'type': 'agent_execution_start', 'message': 'Executing specialist agents...'})}\n\n"

                # Execute the appropriate agent(s)
                if triage_data.decision == TriageDecision.MULTI_AGENT:
                    for agent_type in triage_data.recommended_agents:
                        yield f"data: {json.dumps({
                            'type': 'agent_start',
                            'agent': agent_type.value
                        })}\n\n"

                        try:
                            result = await triage_agent._execute_specialist_agent(
                                deps,
                                agent_type,
                                request.user_query,
                                triage_data.context_for_agents,
                            )

                            yield f"data: {json.dumps({
                                'type': 'agent_result',
                                'agent': agent_type.value,
                                'content': result
                            })}\n\n"

                        except Exception as e:
                            yield f"data: {json.dumps({
                                'type': 'agent_error',
                                'agent': agent_type.value,
                                'error': str(e)
                            })}\n\n"

                else:
                    # Single agent execution
                    agent_type = AgentType(triage_data.decision.value)
                    yield f"data: {json.dumps({
                        'type': 'agent_start',
                        'agent': agent_type.value
                    })}\n\n"

                    try:
                        result = await triage_agent._execute_specialist_agent(
                            deps,
                            agent_type,
                            request.user_query,
                            triage_data.context_for_agents,
                        )

                        yield f"data: {json.dumps({
                            'type': 'agent_result',
                            'agent': agent_type.value,
                            'content': result
                        })}\n\n"

                    except Exception as e:
                        yield f"data: {json.dumps({
                            'type': 'agent_error',
                            'agent': agent_type.value,
                            'error': str(e)
                        })}\n\n"

            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        return StreamingResponse(generate_triage_stream(), media_type="text/plain")

    except Exception as e:
        logger.error(f"Triage streaming failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Triage streaming failed: {str(e)}"
        )


@router.get("/triage/health")
async def triage_health_check() -> Dict[str, Any]:
    """
    Health check for triage system

    Returns status of triage agent and its dependencies.
    """
    try:
        # Check if triage agent is properly initialized
        agent_status = "healthy" if triage_agent.agent is not None else "unhealthy"

        # Check MCP availability
        mcp_status = (
            "available" if triage_agent.factory.mcp_available else "unavailable"
        )

        # Check available agent types
        available_agents = [
            agent.value for agent in triage_agent.factory.get_available_agent_types()
        ]

        return {
            "status": "healthy",
            "triage_agent": agent_status,
            "mcp_server": mcp_status,
            "available_agents": available_agents,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"Triage health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
        }


@router.get("/triage/stats")
async def get_triage_stats() -> Dict[str, Any]:
    """
    Get triage system statistics

    Returns usage statistics and performance metrics.
    """
    try:
        # This would be expanded with actual metrics collection
        return {
            "total_queries": 0,  # Placeholder
            "decisions_by_type": {},  # Placeholder
            "average_confidence": 0.0,  # Placeholder
            "average_execution_time": 0.0,  # Placeholder
            "most_used_agents": [],  # Placeholder
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get triage stats: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get triage stats: {str(e)}"
        )
