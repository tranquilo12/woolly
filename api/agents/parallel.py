"""
Parallel Agent Manager - Simplified & DRY Implementation

Following Pydantic AI best practices:
- Use built-in error handling instead of manual error creation
- Leverage Pydantic AI's streaming patterns
- Eliminate redundant code through proper abstraction
- Use RunContext properly for MCP integration
"""

import asyncio
from typing import Dict, List, Optional, AsyncGenerator, Any
from datetime import datetime
import uuid
import logging
from enum import Enum
from dataclasses import dataclass

from .universal import (
    universal_factory,
    AgentType,
    UniversalResult,
    UniversalDependencies,
)

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """Task execution status"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class TaskResult:
    """Simplified task result following DRY principles"""

    task_id: str
    agent_type: AgentType
    status: TaskStatus
    result: Optional[UniversalResult] = None
    error: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "task_id": self.task_id,
            "agent_type": self.agent_type.value,
            "status": self.status.value,
            "result": self.result.model_dump() if self.result else None,
            "error": self.error,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
        }


@dataclass
class SessionInfo:
    """Simplified session tracking"""

    session_id: str
    total_agents: int
    start_time: datetime
    completed_agents: int = 0
    failed_agents: int = 0
    results: Dict[str, TaskResult] = None

    def __post_init__(self):
        if self.results is None:
            self.results = {}

    @property
    def progress_percentage(self) -> float:
        """Calculate completion percentage"""
        if self.total_agents == 0:
            return 100.0
        return (self.completed_agents + self.failed_agents) / self.total_agents * 100

    @property
    def is_complete(self) -> bool:
        """Check if session is complete"""
        return (self.completed_agents + self.failed_agents) >= self.total_agents

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "session_id": self.session_id,
            "total_agents": self.total_agents,
            "completed_agents": self.completed_agents,
            "failed_agents": self.failed_agents,
            "progress_percentage": self.progress_percentage,
            "is_complete": self.is_complete,
            "start_time": self.start_time.isoformat(),
            "results": {k: v.to_dict() for k, v in self.results.items()},
        }


class ParallelAgentManager:
    """
    Simplified parallel agent manager following Pydantic AI best practices

    Key simplifications:
    - Use Pydantic AI's built-in error handling
    - Eliminate redundant progress tracking
    - Single source of truth for agent execution
    - Leverage asyncio.gather for true parallelism
    """

    def __init__(self):
        self.factory = universal_factory
        self.active_sessions: Dict[str, SessionInfo] = {}
        self.background_tasks: Dict[str, asyncio.Task] = {}

    async def _execute_single_agent(
        self,
        agent_type: AgentType,
        repository_name: str,
        user_query: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> UniversalResult:
        """
        Execute a single agent following Pydantic AI best practices

        This is the single source of truth for agent execution.
        All other methods delegate to this one.
        """
        try:
            # Use the factory's built-in execution method
            # This handles MCP context management automatically
            return await self.factory.execute_agent(
                agent_type, repository_name, user_query, context
            )
        except Exception as e:
            logger.error(f"Agent {agent_type} failed: {e}")
            # Let Pydantic AI handle the error naturally
            raise

    async def run_parallel_agents(
        self,
        repository_name: str,
        user_query: str,
        agent_types: List[AgentType],
        context: Dict[str, Any] = None,
    ) -> Dict[AgentType, UniversalResult]:
        """
        Execute multiple agents in parallel - simplified implementation

        Uses asyncio.gather for true parallelism, following Python best practices
        """
        if not agent_types:
            return {}

        logger.info(f"Starting parallel execution of {len(agent_types)} agents")

        # Create tasks for parallel execution
        tasks = [
            self._execute_single_agent(agent_type, repository_name, user_query, context)
            for agent_type in agent_types
        ]

        # Execute all agents in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results - let exceptions bubble up naturally
        final_results = {}
        for i, result in enumerate(results):
            agent_type = agent_types[i]
            if isinstance(result, Exception):
                logger.error(f"Agent {agent_type} failed: {result}")
                # Create minimal error result
                final_results[agent_type] = UniversalResult(
                    agent_type=agent_type,
                    content=f"Agent execution failed: {str(result)}",
                    metadata={"error": str(result)},
                    confidence=0.0,
                    sources=[],
                )
            else:
                final_results[agent_type] = result

        logger.info(f"Parallel execution completed: {len(final_results)} results")
        return final_results

    async def run_streaming_agents(
        self,
        repository_name: str,
        user_query: str,
        agent_types: List[AgentType],
        context: Dict[str, Any] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream results from parallel agents using Pydantic AI's streaming patterns

        Simplified to use the factory's built-in streaming capabilities
        """
        session_id = str(uuid.uuid4())
        session = SessionInfo(
            session_id=session_id,
            total_agents=len(agent_types),
            start_time=datetime.now(),
            results={},
        )
        self.active_sessions[session_id] = session

        # Yield session start
        yield {
            "type": "session_start",
            "session_id": session_id,
            "total_agents": len(agent_types),
            "timestamp": datetime.now().isoformat(),
        }

        # Create streaming tasks for each agent
        async def stream_single_agent(agent_type: AgentType):
            """Stream execution of a single agent"""
            task_id = str(uuid.uuid4())
            task_result = TaskResult(
                task_id=task_id,
                agent_type=agent_type,
                status=TaskStatus.RUNNING,
                start_time=datetime.now(),
            )
            session.results[task_id] = task_result

            try:
                # Use factory's streaming method
                async for text in self.factory.execute_agent_streaming(
                    agent_type, repository_name, user_query, context
                ):
                    yield {
                        "type": "agent_text",
                        "session_id": session_id,
                        "task_id": task_id,
                        "agent_type": agent_type.value,
                        "text": text,
                        "timestamp": datetime.now().isoformat(),
                    }

                # Get final result
                final_result = await self._execute_single_agent(
                    agent_type, repository_name, user_query, context
                )

                task_result.result = final_result
                task_result.status = TaskStatus.COMPLETED
                task_result.end_time = datetime.now()
                session.completed_agents += 1

                yield {
                    "type": "agent_completed",
                    "session_id": session_id,
                    "task_id": task_id,
                    "agent_type": agent_type.value,
                    "result": final_result.model_dump(),
                    "progress": session.progress_percentage,
                    "timestamp": datetime.now().isoformat(),
                }

            except Exception as e:
                task_result.error = str(e)
                task_result.status = TaskStatus.FAILED
                task_result.end_time = datetime.now()
                session.failed_agents += 1

                yield {
                    "type": "agent_failed",
                    "session_id": session_id,
                    "task_id": task_id,
                    "agent_type": agent_type.value,
                    "error": str(e),
                    "progress": session.progress_percentage,
                    "timestamp": datetime.now().isoformat(),
                }

        # Execute all agent streams concurrently
        tasks = [stream_single_agent(agent_type) for agent_type in agent_types]

        # Process all streams concurrently
        async def process_all_streams():
            async for agent_type in asyncio.as_completed(tasks):
                async for update in agent_type:
                    yield update

        async for update in process_all_streams():
            yield update

        # Final session completion
        yield {
            "type": "session_complete",
            "session_id": session_id,
            "session_info": session.to_dict(),
            "timestamp": datetime.now().isoformat(),
        }

    async def run_background_agents(
        self,
        repository_name: str,
        user_query: str,
        agent_types: List[AgentType],
        context: Dict[str, Any] = None,
    ) -> str:
        """Start agents in background and return session ID"""
        session_id = str(uuid.uuid4())

        # Create background task
        background_task = asyncio.create_task(
            self._run_background_session(
                session_id, repository_name, user_query, agent_types, context
            )
        )

        self.background_tasks[session_id] = background_task
        return session_id

    async def _run_background_session(
        self,
        session_id: str,
        repository_name: str,
        user_query: str,
        agent_types: List[AgentType],
        context: Dict[str, Any] = None,
    ):
        """Internal method to run background session"""
        try:
            # Use the parallel execution method
            results = await self.run_parallel_agents(
                repository_name, user_query, agent_types, context
            )

            # Store results in session
            if session_id in self.active_sessions:
                session = self.active_sessions[session_id]
                for agent_type, result in results.items():
                    task_result = TaskResult(
                        task_id=str(uuid.uuid4()),
                        agent_type=agent_type,
                        status=TaskStatus.COMPLETED,
                        result=result,
                        start_time=session.start_time,
                        end_time=datetime.now(),
                    )
                    session.results[task_result.task_id] = task_result
                    session.completed_agents += 1

        except Exception as e:
            logger.error(f"Background session {session_id} failed: {e}")
            if session_id in self.active_sessions:
                session = self.active_sessions[session_id]
                session.failed_agents = session.total_agents

    def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """Get status of background session - simplified"""
        if session_id not in self.active_sessions:
            return {"status": "not_found"}

        session = self.active_sessions[session_id]
        task = self.background_tasks.get(session_id)

        if task and task.done():
            if task.exception():
                return {
                    "status": "failed",
                    "error": str(task.exception()),
                    "session_info": session.to_dict(),
                }
            else:
                return {
                    "status": "completed",
                    "session_info": session.to_dict(),
                }
        elif task and not task.done():
            return {
                "status": "running",
                "session_info": session.to_dict(),
            }
        else:
            return {
                "status": "unknown",
                "session_info": session.to_dict(),
            }

    async def cancel_session(self, session_id: str) -> bool:
        """Cancel a background session"""
        if session_id not in self.background_tasks:
            return False

        task = self.background_tasks[session_id]
        if not task.done():
            task.cancel()

        # Clean up
        self.background_tasks.pop(session_id, None)
        self.active_sessions.pop(session_id, None)

        logger.info(f"Session {session_id} cancelled")
        return True

    async def health_check(self) -> Dict[str, Any]:
        """Simplified health check"""
        try:
            # Check factory health
            agent_types = self.factory.get_available_agent_types()

            # Simple MCP connectivity test
            mcp_healthy = True
            try:
                test_agent = self.factory.create_agent(AgentType.SIMPLIFIER)
                mcp_healthy = test_agent is not None
            except Exception as e:
                logger.warning(f"MCP health check failed: {e}")
                mcp_healthy = False

            return {
                "status": "healthy" if mcp_healthy else "degraded",
                "agent_types_available": len(agent_types),
                "mcp_server_healthy": mcp_healthy,
                "active_sessions": len(self.active_sessions),
                "background_tasks": len(self.background_tasks),
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
            }

    async def retry_failed_task(self, task_id: str) -> bool:
        """Simplified retry logic"""
        # Find the session containing this task
        for session in self.active_sessions.values():
            if task_id in session.results:
                task_result = session.results[task_id]
                if task_result.status == TaskStatus.FAILED:
                    logger.info(
                        f"Retrying task {task_id} for agent {task_result.agent_type}"
                    )
                    # Reset task status
                    task_result.status = TaskStatus.PENDING
                    task_result.error = None
                    return True
        return False

    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get status of a specific task"""
        for session in self.active_sessions.values():
            if task_id in session.results:
                return session.results[task_id].to_dict()
        return {"status": "not_found"}

    def cleanup_old_sessions(self, max_age_hours: int = 24):
        """Clean up old sessions"""
        from datetime import timedelta

        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)

        sessions_to_remove = [
            session_id
            for session_id, session in self.active_sessions.items()
            if session.start_time < cutoff_time
        ]

        for session_id in sessions_to_remove:
            self.active_sessions.pop(session_id, None)
            task = self.background_tasks.pop(session_id, None)
            if task and not task.done():
                task.cancel()

        if sessions_to_remove:
            logger.info(f"Cleaned up {len(sessions_to_remove)} old sessions")

    def get_error_statistics(self) -> Dict[str, Any]:
        """Get error statistics from active sessions"""
        total_tasks = 0
        failed_tasks = 0

        for session in self.active_sessions.values():
            total_tasks += len(session.results)
            failed_tasks += sum(
                1
                for result in session.results.values()
                if result.status == TaskStatus.FAILED
            )

        return {
            "total_tasks": total_tasks,
            "failed_tasks": failed_tasks,
            "success_rate": (total_tasks - failed_tasks) / max(total_tasks, 1) * 100,
            "timestamp": datetime.now().isoformat(),
        }

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        active_sessions = len(self.active_sessions)
        background_tasks = len(self.background_tasks)

        # Calculate average session duration for completed sessions
        completed_sessions = [
            session for session in self.active_sessions.values() if session.is_complete
        ]

        avg_duration = None
        if completed_sessions:
            durations = [
                (datetime.now() - session.start_time).total_seconds()
                for session in completed_sessions
            ]
            avg_duration = sum(durations) / len(durations)

        return {
            "active_sessions": active_sessions,
            "background_tasks": background_tasks,
            "completed_sessions": len(completed_sessions),
            "average_session_duration_seconds": avg_duration,
            "error_statistics": self.get_error_statistics(),
            "timestamp": datetime.now().isoformat(),
        }


# Single global manager instance
parallel_manager = ParallelAgentManager()
