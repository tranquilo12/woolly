"""
Universal Agent Router - Simplified API Layer

This module provides unified endpoints for all agent types:
- 2 endpoints replace 10+ specialized ones (80% reduction)
- Native streaming support following Pydantic AI best practices
- Background task management with progress tracking
- Parallel execution of multiple agent types
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from uuid import UUID
import logging
from datetime import datetime
from sqlalchemy.orm import Session

from ..agents.universal import AgentType, get_universal_factory
from ..agents.parallel import parallel_manager
from ..utils.database import get_db
from ..routers.agents import save_agent_message

router = APIRouter()
logger = logging.getLogger(__name__)

# Get factory instance for streaming
factory = get_universal_factory()


class UniversalRequest(BaseModel):
    """Single request model for all agent operations"""

    repository_name: str
    user_query: str
    agent_types: list[AgentType] = Field(
        default=[
            AgentType.SIMPLIFIER,
            AgentType.TESTER,
            AgentType.CONVO_STARTER,
            AgentType.SUMMARIZER,
        ],
        description="List of agent types to execute",
    )
    context: Dict[str, Any] = Field(default_factory=dict)
    run_in_background: bool = Field(
        default=False, description="Run agents in background"
    )
    enable_streaming: bool = Field(
        default=True, description="Enable streaming responses"
    )

    # Optional database fields for message saving
    chat_id: Optional[UUID] = None
    agent_id: Optional[UUID] = None


class UniversalResponse(BaseModel):
    """Single response model for all agent operations"""

    status: str
    agent_count: int
    session_id: Optional[str] = None
    task_id: Optional[str] = None
    results: Optional[Dict[str, Dict[str, Any]]] = None
    message: Optional[str] = None


class SingleAgentRequest(BaseModel):
    """Request model for single agent execution"""

    repository_name: str
    user_query: str
    agent_type: AgentType
    context: Dict[str, Any] = Field(default_factory=dict)
    enable_streaming: bool = Field(default=True)

    # Optional database fields
    chat_id: Optional[UUID] = None
    agent_id: Optional[UUID] = None


@router.post("/agents/execute")
async def execute_agents(
    request: UniversalRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> UniversalResponse:
    """
    Universal endpoint for executing multiple agents

    Supports:
    - Immediate parallel execution
    - Background processing with session tracking
    - All 5 agent types: Simplifier, Tester, ConvoStarter, Summarizer, Documentation
    """

    if not request.agent_types:
        raise HTTPException(
            status_code=400, detail="At least one agent type must be specified"
        )

    try:
        if request.run_in_background:
            # Background execution with session tracking
            session_id = await parallel_manager.run_background_session(
                repository_name=request.repository_name,
                user_query=request.user_query,
                agent_types=request.agent_types,
                context=request.context,
            )

            # Save background session info to database if chat_id provided
            if request.chat_id and request.agent_id:
                background_tasks.add_task(
                    save_agent_message,
                    chat_id=request.chat_id,
                    content=f"Started background execution of {len(request.agent_types)} agents",
                    role="assistant",
                    model="universal-agent-system",
                    db=db,
                    agent_id=request.agent_id,
                    repository=request.repository_name,
                    message_type="agent_execution",
                    tool_invocations=[
                        {
                            "type": "background_agents",
                            "session_id": session_id,
                            "agent_types": [at.value for at in request.agent_types],
                        }
                    ],
                )

            return UniversalResponse(
                status="started",
                agent_count=len(request.agent_types),
                session_id=session_id,
                message=f"Background execution started for {len(request.agent_types)} agents",
            )

        else:
            # Immediate parallel execution
            results = await parallel_manager.execute_parallel_agents(
                repository_name=request.repository_name,
                user_query=request.user_query,
                agent_types=request.agent_types,
                context=request.context,
            )

            # Save results to database if chat_id provided
            if request.chat_id and request.agent_id:
                for agent_type, result in results.items():
                    background_tasks.add_task(
                        save_agent_message,
                        chat_id=request.chat_id,
                        content=result.content,
                        role="assistant",
                        model="universal-agent-system",
                        db=db,
                        agent_id=request.agent_id,
                        repository=request.repository_name,
                        message_type="agent_result",
                        tool_invocations=[
                            {
                                "type": "agent_execution",
                                "agent_type": agent_type.value,
                                "metadata": result.metadata,
                            }
                        ],
                    )

            return UniversalResponse(
                status="completed",
                agent_count=len(results),
                results={
                    agent_type.value: result.model_dump()
                    for agent_type, result in results.items()
                },
                message=f"Successfully executed {len(results)} agents",
            )

    except Exception as e:
        logger.error(f"Agent execution failed: {e}")
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {str(e)}")


@router.post("/agents/execute/streaming")
async def execute_agents_streaming(
    request: UniversalRequest, db: Session = Depends(get_db)
):
    """
    Universal streaming endpoint for real-time agent execution

    Returns Server-Sent Events with agent results as they complete
    Following Pydantic AI streaming best practices
    """

    if not request.agent_types:
        raise HTTPException(
            status_code=400, detail="At least one agent type must be specified"
        )

    async def stream_agent_results():
        """Generate streaming response with AI SDK V5 formatting"""
        from api.utils.models import build_text_stream, build_end_of_stream_message

        try:
            # Send initial status as text
            yield build_text_stream(
                f"🚀 Starting execution of {len(request.agent_types)} agents...\n\n"
            )

            # Stream results from parallel agents
            async for result in parallel_manager.stream_parallel_agents(
                repository_name=request.repository_name,
                user_query=request.user_query,
                agent_types=request.agent_types,
                context=request.context,
            ):
                # The parallel manager now returns V5-formatted events directly
                # Check if it's a structured result that needs conversion
                if isinstance(result, dict) and result.get("type") == "agent_stream":
                    # Convert agent stream events to V5 text format
                    content = result.get("content", "")
                    if content:
                        yield build_text_stream(content)
                elif (
                    isinstance(result, dict) and result.get("type") == "agent_complete"
                ):
                    # Handle completion events
                    agent_type = result.get("agent_type", "unknown")
                    yield build_text_stream(f"\n✅ {agent_type} analysis completed\n\n")

                    # Save completed results to database
                    if request.chat_id and request.agent_id:
                        final_result = result.get("result", {})
                        content = (
                            final_result.get("content", str(final_result))
                            if isinstance(final_result, dict)
                            else str(final_result)
                        )

                        # Save asynchronously to avoid blocking the stream
                        import asyncio

                        asyncio.create_task(
                            save_agent_message(
                                chat_id=request.chat_id,
                                content=content,
                                role="assistant",
                                model="universal-agent-system",
                                db=db,
                                agent_id=request.agent_id,
                                repository=request.repository_name,
                                message_type="streaming_agent_result",
                                tool_invocations=[
                                    {
                                        "type": "streaming_agent",
                                        "agent_type": result["agent_type"],
                                        "timestamp": result["timestamp"],
                                    }
                                ],
                            )
                        )
                elif isinstance(result, dict) and result.get("type") == "agent_error":
                    # Handle error events
                    agent_type = result.get("agent_type", "unknown")
                    error_msg = result.get("error", "Unknown error")
                    yield build_text_stream(
                        f"\n❌ {agent_type} failed: {error_msg}\n\n"
                    )
                elif isinstance(result, str):
                    # Direct string result (already V5 formatted)
                    yield result

            # Send completion status using V5 end-of-stream format
            yield build_end_of_stream_message(
                finish_reason="stop",
                prompt_tokens=len(request.agent_types) * 50,  # Rough estimate
                completion_tokens=200,  # Rough estimate
                is_continued=False,
            )

        except Exception as e:
            logger.error(f"Streaming execution failed: {e}")
            yield build_text_stream(f"\n❌ Streaming execution failed: {str(e)}\n\n")
            yield build_end_of_stream_message(
                finish_reason="error",
                prompt_tokens=0,
                completion_tokens=0,
                is_continued=False,
            )

    return StreamingResponse(
        stream_agent_results(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.post("/agents/execute/single")
async def execute_single_agent(
    request: SingleAgentRequest, db: Session = Depends(get_db)
):
    """
    Execute a single agent with optional streaming

    Optimized for single agent execution with immediate results
    """

    try:
        if request.enable_streaming:
            # Streaming single agent execution with AI SDK V5 format
            async def stream_single_agent():
                from api.utils.models import (
                    build_text_stream,
                    build_end_of_stream_message,
                )

                try:
                    yield build_text_stream(
                        f"🚀 Starting {request.agent_type.value} agent...\n\n"
                    )

                    # Use the universal factory's streaming method for real-time updates
                    async for chunk in factory.execute_agent_streaming(
                        agent_type=request.agent_type,
                        repository_name=request.repository_name,
                        user_query=request.user_query,
                        context=request.context,
                    ):
                        # The factory now returns V5-formatted chunks directly
                        yield chunk

                    # Send completion
                    yield build_end_of_stream_message(
                        finish_reason="stop",
                        prompt_tokens=50,  # Rough estimate
                        completion_tokens=100,  # Rough estimate
                        is_continued=False,
                    )

                except Exception as e:
                    logger.error(f"Single agent streaming failed: {e}")
                    yield build_text_stream(
                        f"\n❌ Single agent execution failed: {str(e)}\n\n"
                    )
                    yield build_end_of_stream_message(
                        finish_reason="error",
                        prompt_tokens=0,
                        completion_tokens=0,
                        is_continued=False,
                    )

            return StreamingResponse(
                stream_single_agent(),
                media_type="text/plain",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            )
        else:
            # Non-streaming execution
            result = await parallel_manager._execute_single_agent(
                agent_type=request.agent_type,
                repository_name=request.repository_name,
                user_query=request.user_query,
                context=request.context,
            )

            # Save result to database if requested
            if request.chat_id and request.agent_id:
                await save_agent_message(
                    chat_id=request.chat_id,
                    content=result.content,
                    role="assistant",
                    model="universal-agent-system",
                    db=db,
                    agent_id=request.agent_id,
                    repository=request.repository_name,
                    message_type="single_agent_result",
                    tool_invocations=[
                        {
                            "type": "single_agent",
                            "agent_type": request.agent_type.value,
                            "metadata": result.metadata,
                        }
                    ],
                )

            return {
                "status": "completed",
                "agent_type": request.agent_type.value,
                "result": result.model_dump(),
            }

    except Exception as e:
        logger.error(f"Single agent execution failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Single agent execution failed: {str(e)}"
        )


@router.get("/agents/session/{session_id}")
async def get_session_status(session_id: str) -> Dict[str, Any]:
    """Get status of background agent session"""
    status = parallel_manager.get_session_status(session_id)
    if status["status"] == "not_found":
        raise HTTPException(status_code=404, detail="Session not found")
    return status


@router.delete("/agents/session/{session_id}")
async def cancel_session(session_id: str) -> Dict[str, Any]:
    """Cancel background agent session"""
    success = await parallel_manager.cancel_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "cancelled", "session_id": session_id}


@router.get("/agents/task/{task_id}")
async def get_task_status(task_id: str) -> Dict[str, Any]:
    """Get status of individual agent task"""
    status = parallel_manager.get_task_status(task_id)
    if status["status"] == "not_found":
        raise HTTPException(status_code=404, detail="Task not found")
    return status


@router.get("/agents/types")
async def get_available_agent_types() -> Dict[str, Any]:
    """Get list of available agent types with descriptions"""
    return {
        "agent_types": [
            agent_type.value
            for agent_type in get_universal_factory().get_available_agent_types()
        ],
        "descriptions": {
            agent_type.value: get_universal_factory().get_agent_description(agent_type)
            for agent_type in get_universal_factory().get_available_agent_types()
        },
        "total_count": len(get_universal_factory().get_available_agent_types()),
    }


@router.get("/agents/health")
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint for universal agent system
    """
    try:
        # Get factory health status
        factory_health = await get_universal_factory().health_check()

        # Get parallel manager health
        parallel_health = await parallel_manager.health_check()

        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "factory": factory_health,
            "parallel_manager": parallel_health,
            "available_agents": len(
                get_universal_factory().get_available_agent_types()
            ),
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
        }


@router.get("/agents/mcp/test")
async def test_mcp_connection() -> Dict[str, Any]:
    """
    Test MCP server connection to diagnose TaskGroup errors
    """
    try:
        test_result = await get_universal_factory().test_mcp_connection()
        return {
            "status": "completed",
            "timestamp": datetime.now().isoformat(),
            "test_result": test_result,
        }
    except Exception as e:
        logger.error(f"MCP connection test failed: {e}")
        return {
            "status": "failed",
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
        }


@router.get("/agents/errors/statistics")
async def get_error_statistics() -> Dict[str, Any]:
    """Get comprehensive error statistics for monitoring and debugging"""
    return parallel_manager.get_error_statistics()


@router.post("/agents/errors/reset")
async def reset_error_statistics() -> Dict[str, Any]:
    """Reset error statistics for fresh monitoring"""
    parallel_manager.reset_error_statistics()
    return {"status": "reset", "timestamp": datetime.now().isoformat()}


@router.post("/agents/task/{task_id}/retry")
async def retry_failed_task(task_id: str) -> Dict[str, Any]:
    """Retry a failed task if it's retryable"""
    success = await parallel_manager.retry_failed_task(task_id)
    if success:
        return {
            "status": "retrying",
            "task_id": task_id,
            "timestamp": datetime.now().isoformat(),
        }
    else:
        task_status = parallel_manager.get_task_status(task_id)
        if task_status["status"] == "not_found":
            raise HTTPException(status_code=404, detail="Task not found")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Task cannot be retried: {task_status.get('error_details', {}).get('message', 'Unknown reason')}",
            )
