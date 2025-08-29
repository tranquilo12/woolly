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
            """Generate AI SDK V5 compatible streaming response"""
            from api.utils.models import (
                build_text_stream,
                build_end_of_stream_message,
            )
            from ..agents.universal import get_universal_factory

            # First, analyze the query
            yield build_text_stream(
                "🔍 Analyzing query and determining best approach...\n\n"
            )

            # Get triage decision
            from ..agents.triage import TriageDependencies

            deps = TriageDependencies(
                repository_name=request.repository_name,
                user_context=request.user_context,
                conversation_history=request.conversation_history,
            )

            triage_result = await triage_agent.agent.run(request.user_query, deps=deps)
            triage_data = triage_result.data

            # Send triage decision as text
            decision_text = f"🎯 **Triage Decision**: {triage_data.decision.value}\n"
            decision_text += f"**Reasoning**: {triage_data.reasoning}\n"
            decision_text += f"**Confidence**: {triage_data.confidence:.2f}\n"
            if triage_data.recommended_agents:
                agents_list = ", ".join(
                    [agent.value for agent in triage_data.recommended_agents]
                )
                decision_text += f"**Recommended Agents**: {agents_list}\n\n"
            else:
                decision_text += "\n"

            yield build_text_stream(decision_text)

            # Execute based on decision
            if triage_data.decision == TriageDecision.DIRECT_RESPONSE:
                yield build_text_stream(
                    f"💬 **Direct Response**:\n{triage_data.direct_response}\n\n"
                )

            else:
                yield build_text_stream("🚀 Executing specialist agents...\n\n")

                # Get universal factory for consistent agent execution
                factory = get_universal_factory()

                # Execute the appropriate agent(s)
                if triage_data.decision == TriageDecision.MULTI_AGENT:
                    for agent_type in triage_data.recommended_agents:
                        yield build_text_stream(
                            f"▶️ Starting {agent_type.value} agent...\n\n"
                        )

                        try:
                            # Use the universal factory's streaming method for consistency
                            async for chunk in factory.execute_agent_streaming(
                                agent_type=agent_type,
                                repository_name=request.repository_name,
                                user_query=request.user_query,
                                context=triage_data.context_for_agents,
                            ):
                                # Pass through V5-formatted chunks directly
                                yield chunk

                            yield build_text_stream(
                                f"✅ {agent_type.value} agent completed\n\n"
                            )

                        except Exception as e:
                            yield build_text_stream(
                                f"❌ {agent_type.value} agent failed: {str(e)}\n\n"
                            )

                else:
                    # Single agent execution
                    agent_type = AgentType(triage_data.decision.value)
                    yield build_text_stream(
                        f"▶️ Starting {agent_type.value} agent...\n\n"
                    )

                    try:
                        # Use the universal factory's streaming method for consistency
                        async for chunk in factory.execute_agent_streaming(
                            agent_type=agent_type,
                            repository_name=request.repository_name,
                            user_query=request.user_query,
                            context=triage_data.context_for_agents,
                        ):
                            # Pass through V5-formatted chunks directly
                            yield chunk

                        yield build_text_stream(
                            f"✅ {agent_type.value} agent completed\n\n"
                        )

                    except Exception as e:
                        yield build_text_stream(
                            f"❌ {agent_type.value} agent failed: {str(e)}\n\n"
                        )

            # Send completion using V5 end-of-stream format
            yield build_end_of_stream_message(
                finish_reason="stop",
                prompt_tokens=100,  # Rough estimate for triage analysis
                completion_tokens=300,  # Rough estimate for agent results
                is_continued=False,
            )

        async def error_wrapped_stream():
            """Wrap the stream with V5-compatible error handling"""
            from api.utils.models import build_text_stream, build_end_of_stream_message

            try:
                async for chunk in generate_triage_stream():
                    yield chunk
            except Exception as e:
                logger.error(f"Triage streaming failed: {e}")
                yield build_text_stream(f"\n❌ Triage execution failed: {str(e)}\n\n")
                yield build_end_of_stream_message(
                    finish_reason="error",
                    prompt_tokens=0,
                    completion_tokens=0,
                    is_continued=False,
                )

        return StreamingResponse(
            error_wrapped_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    except Exception as e:
        logger.error(f"Triage streaming setup failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Triage streaming setup failed: {str(e)}"
        )


@router.get("/triage/health")
async def triage_health_check() -> Dict[str, Any]:
    """Redirect to unified health endpoint."""
    return {
        "status": "moved",
        "message": "Use unified health endpoint at /api/v2/health",
        "endpoint": "/api/v2/health",
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
