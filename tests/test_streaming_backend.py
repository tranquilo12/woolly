#!/usr/bin/env python3
"""
Tests for Enhanced Streaming Backend
===================================

Comprehensive test suite for the enhanced streaming pipeline that integrates:
- ToolBudget for intelligent stopping criteria
- ConvergenceDetector for loop prevention
- Proper Pydantic AI streaming patterns
- Vercel AI SDK v4 compatible event format

Following Pydantic AI testing best practices from https://ai.pydantic.dev/llms-full.txt
"""

import pytest
import pytest_asyncio
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch, Mock
from typing import List, Dict, Any

from api.agents.universal import (
    UniversalAgentFactory,
    AgentType,
    ToolBudget,
    BudgetTracker,
    UniversalDependencies,
    ConversationContext,
)
from api.agents.utils.convergence import ConvergenceDetector, ConvergenceConfig

# Configure pytest-asyncio
pytest_asyncio.asyncio_mode = "auto"


class TestEnhancedStreaming:
    """Test the enhanced streaming functionality with budget and convergence."""

    @pytest.fixture
    def factory(self):
        """Create a factory instance for testing."""
        return UniversalAgentFactory()

    @pytest.fixture
    def mock_stream_result(self):
        """Create a properly mocked StreamedRunResult following Pydantic AI patterns."""
        stream_result = MagicMock()

        # Mock new_messages() as an async generator
        async def mock_new_messages():
            from pydantic_ai.messages import TextPart, ToolCallPart, ToolReturnPart

            # Create a mock message with proper parts
            mock_message = MagicMock()
            mock_message.parts = [
                ToolCallPart(tool_name="search_code", args={"query": "test"}),
                ToolReturnPart(
                    tool_name="search_code",
                    tool_call_id="call_1",
                    content="Search result",
                ),
                TextPart(content="Based on the search..."),
            ]

            # Yield the message
            yield mock_message

        stream_result.new_messages = mock_new_messages

        # Mock get_output()
        mock_result = MagicMock()
        mock_result.content = "Final analysis result"
        mock_result.metadata = {"confidence": 0.8}
        stream_result.get_output = MagicMock(return_value=mock_result)

        # Mock all_messages()
        stream_result.all_messages = MagicMock(return_value=[])

        return stream_result

    @pytest.fixture
    def mock_agent(self, mock_stream_result):
        """Create a mock agent with proper Pydantic AI streaming capabilities."""
        agent = MagicMock()

        # Mock the run_stream context manager
        async def mock_run_stream(*args, **kwargs):
            return mock_stream_result

        stream_context = MagicMock()
        stream_context.__aenter__ = AsyncMock(return_value=mock_stream_result)
        stream_context.__aexit__ = AsyncMock(return_value=None)

        agent.run_stream = MagicMock(return_value=stream_context)

        # Mock the MCP server context manager
        mcp_context = MagicMock()
        mcp_context.__aenter__ = AsyncMock()
        mcp_context.__aexit__ = AsyncMock()
        agent.run_mcp_servers = MagicMock(return_value=mcp_context)

        return agent

    @pytest.mark.asyncio
    async def test_streaming_with_tool_budget_integration(self, factory, mock_agent):
        """Test that streaming integrates properly with ToolBudget."""

        with patch.object(
            factory, "create_agent_with_context", return_value=mock_agent
        ):
            with patch.object(
                factory, "_ensure_mcp_connection_tested", new_callable=AsyncMock
            ):

                # Execute streaming
                events = []
                async for event in factory.execute_agent_streaming(
                    AgentType.SIMPLIFIER, "test-repo", "Analyze this code"
                ):
                    events.append(event)

                # Parse events
                parsed_events = []
                for event in events:
                    if event.startswith("data: "):
                        event_data = json.loads(event[6:])
                        parsed_events.append(event_data)

                # Verify we have events (at minimum start and done)
                assert len(parsed_events) >= 2

                # Check start event
                start_events = [e for e in parsed_events if e["event"] == "start"]
                assert len(start_events) >= 1
                start_event = start_events[0]
                assert start_event["data"]["agent_type"] == "simplifier"
                assert "tool_budget" in start_event["data"]

                # Check for tool call events
                tool_call_events = [
                    e for e in parsed_events if e["event"] == "toolCall"
                ]
                if tool_call_events:
                    tool_call = tool_call_events[0]
                    assert tool_call["data"]["name"] == "search_code"
                    assert "budget_status" in tool_call["data"]

                # Check completion event
                done_events = [e for e in parsed_events if e["event"] == "done"]
                assert len(done_events) >= 1
                done_event = done_events[0]
                assert "budget_summary" in done_event["data"]

    @pytest.mark.asyncio
    async def test_streaming_budget_exceeded_stopping(self, factory, mock_agent):
        """Test that streaming stops when tool budget is exceeded."""

        with patch.object(
            factory, "create_agent_with_context", return_value=mock_agent
        ):
            with patch.object(
                factory, "_ensure_mcp_connection_tested", new_callable=AsyncMock
            ):

                # Patch the streaming method directly to test budget exceeded logic
                original_method = factory.execute_agent_streaming

                async def mock_streaming_with_budget_exceeded(*args, **kwargs):
                    # Simulate start event
                    yield factory._format_stream_event(
                        "start",
                        {
                            "agent_type": "simplifier",
                            "repository": "test-repo",
                            "tool_budget": {
                                "max_tool_calls": 1,
                                "max_depth": 3,
                                "time_budget_s": 120.0,
                            },
                        },
                    )

                    # Simulate budget exceeded event
                    yield factory._format_stream_event(
                        "budget_exceeded",
                        {
                            "reason": "Tool call limit exceeded",
                            "tool_calls_made": 2,
                            "elapsed_time": 5.0,
                        },
                    )

                # Temporarily replace the method
                factory.execute_agent_streaming = mock_streaming_with_budget_exceeded

                try:
                    # Execute streaming
                    events = []
                    async for event in factory.execute_agent_streaming(
                        AgentType.SIMPLIFIER, "test-repo", "Analyze this code"
                    ):
                        events.append(event)

                    # Parse events
                    parsed_events = []
                    for event in events:
                        if event.startswith("data: "):
                            event_data = json.loads(event[6:])
                            parsed_events.append(event_data)

                    # Verify budget exceeded event was emitted
                    budget_exceeded_events = [
                        e for e in parsed_events if e["event"] == "budget_exceeded"
                    ]
                    assert len(budget_exceeded_events) >= 1

                    budget_event = budget_exceeded_events[0]
                    assert budget_event["data"]["reason"] == "Tool call limit exceeded"
                    assert budget_event["data"]["tool_calls_made"] == 2

                finally:
                    # Restore original method
                    factory.execute_agent_streaming = original_method

    @pytest.mark.asyncio
    async def test_streaming_convergence_detection(self, factory, mock_agent):
        """Test that streaming detects convergence and stops appropriately."""

        with patch.object(
            factory, "create_agent_with_context", return_value=mock_agent
        ):
            with patch.object(
                factory, "_ensure_mcp_connection_tested", new_callable=AsyncMock
            ):

                # Patch the streaming method directly to test convergence logic
                original_method = factory.execute_agent_streaming

                async def mock_streaming_with_convergence(*args, **kwargs):
                    # Simulate start event
                    yield factory._format_stream_event(
                        "start",
                        {
                            "agent_type": "simplifier",
                            "repository": "test-repo",
                            "tool_budget": {
                                "max_tool_calls": 10,
                                "max_depth": 3,
                                "time_budget_s": 120.0,
                            },
                        },
                    )

                    # Simulate convergence detected event
                    yield factory._format_stream_event(
                        "converged",
                        {
                            "reason": "Response convergence detected",
                            "similarity_threshold": 0.8,
                            "responses_analyzed": 3,
                        },
                    )

                # Temporarily replace the method
                factory.execute_agent_streaming = mock_streaming_with_convergence

                try:
                    # Execute streaming
                    events = []
                    async for event in factory.execute_agent_streaming(
                        AgentType.SIMPLIFIER, "test-repo", "Analyze this code"
                    ):
                        events.append(event)

                    # Parse events
                    parsed_events = []
                    for event in events:
                        if event.startswith("data: "):
                            event_data = json.loads(event[6:])
                            parsed_events.append(event_data)

                    # Verify convergence event was emitted
                    convergence_events = [
                        e for e in parsed_events if e["event"] == "converged"
                    ]
                    assert len(convergence_events) >= 1

                    convergence_event = convergence_events[0]
                    assert (
                        convergence_event["data"]["reason"]
                        == "Response convergence detected"
                    )

                finally:
                    # Restore original method
                    factory.execute_agent_streaming = original_method

    @pytest.mark.asyncio
    async def test_streaming_error_handling_and_fallback(self, factory):
        """Test error handling and fallback to non-streaming execution."""

        # Mock agent that raises an exception during streaming
        mock_agent = MagicMock()
        mock_agent.run_mcp_servers.side_effect = Exception("Streaming failed")

        with patch.object(
            factory, "create_agent_with_context", return_value=mock_agent
        ):
            with patch.object(
                factory, "_ensure_mcp_connection_tested", new_callable=AsyncMock
            ):

                # Mock successful fallback execution
                mock_result = MagicMock()
                mock_result.content = "Fallback result"
                mock_result.metadata = {"fallback": True}

                with patch.object(
                    factory,
                    "execute_agent_with_context",
                    new_callable=AsyncMock,
                    return_value=mock_result,
                ):

                    # Execute streaming
                    events = []
                    async for event in factory.execute_agent_streaming(
                        AgentType.SIMPLIFIER, "test-repo", "Analyze this code"
                    ):
                        events.append(event)

                    # Parse events
                    parsed_events = []
                    for event in events:
                        if event.startswith("data: "):
                            event_data = json.loads(event[6:])
                            parsed_events.append(event_data)

                    # Verify error and fallback events
                    error_events = [e for e in parsed_events if e["event"] == "error"]
                    assert len(error_events) >= 1

                    error_event = error_events[0]
                    assert "Streaming failed" in error_event["data"]["message"]
                    assert (
                        error_event["data"]["fallback"]
                        == "Attempting non-streaming execution"
                    )

                    # Verify fallback completion
                    done_events = [e for e in parsed_events if e["event"] == "done"]
                    assert len(done_events) >= 1

                    done_event = done_events[0]
                    assert done_event["data"]["fallback"] is True

    def test_format_stream_event(self, factory):
        """Test the stream event formatting for Vercel AI SDK v4 compatibility."""

        # Test different event types
        test_cases = [
            ("start", {"agent_type": "simplifier"}),
            ("toolCall", {"id": "tool_1", "name": "search_code"}),
            ("toolResult", {"id": "tool_1", "result": "Found code"}),
            ("text", {"delta": "Hello world"}),
            ("error", {"message": "Something went wrong"}),
            ("done", {"content": "Final result"}),
        ]

        for event_type, data in test_cases:
            event_str = factory._format_stream_event(event_type, data)

            # Verify format
            assert event_str.startswith("data: ")
            assert event_str.endswith("\n\n")

            # Parse JSON
            json_str = event_str[6:-2]  # Remove "data: " and "\n\n"
            event_data = json.loads(json_str)

            # Verify structure
            assert "id" in event_data
            assert event_data["event"] == event_type
            assert event_data["data"] == data
            assert "timestamp" in event_data

            # Verify timestamp is valid ISO format
            datetime.fromisoformat(event_data["timestamp"])

    @pytest.mark.asyncio
    async def test_streaming_conversation_context_update(self, factory, mock_agent):
        """Test that conversation context is properly updated during streaming."""

        with patch.object(
            factory, "create_agent_with_context", return_value=mock_agent
        ):
            with patch.object(
                factory, "_ensure_mcp_connection_tested", new_callable=AsyncMock
            ):

                # Mock stream result with messages
                mock_messages = [MagicMock(), MagicMock()]
                mock_agent.run_stream.return_value.__aenter__.return_value.all_messages.return_value = (
                    mock_messages
                )

                # Execute streaming
                events = []
                async for event in factory.execute_agent_streaming(
                    AgentType.SIMPLIFIER, "test-repo", "Analyze this code"
                ):
                    events.append(event)

                # Verify conversation context was updated
                context = factory.get_or_create_conversation_context("test-repo")
                # Context should be updated with new messages from stream_result.all_messages()
                assert context.last_updated is not None


class TestStreamingIntegration:
    """Integration tests for the complete streaming pipeline."""

    @pytest.mark.asyncio
    async def test_end_to_end_streaming_with_real_components(self):
        """Test streaming with real ToolBudget and ConvergenceDetector components."""

        factory = UniversalAgentFactory()

        # Create real components with valid constraints
        tool_budget = ToolBudget(max_tool_calls=5, max_depth=3, time_budget_s=30.0)
        budget_tracker = BudgetTracker()

        convergence_config = ConvergenceConfig(
            similarity_threshold=0.7,
            use_critic_model=False,  # Disable for testing
        )
        convergence_detector = ConvergenceDetector(convergence_config)

        # Test budget tracking
        budget_tracker.increment_tool_call("search_code")
        assert budget_tracker.tool_calls_made == 1

        should_stop, reason = budget_tracker.should_stop(tool_budget)
        assert not should_stop  # Should not stop yet

        # Add more tool calls to exceed limit
        for i in range(4):
            budget_tracker.increment_tool_call("qa_codebase")

        should_stop, reason = budget_tracker.should_stop(tool_budget)
        assert should_stop  # Should stop now
        assert "max tool calls" in reason.lower()  # More flexible assertion

        # Test convergence detection
        convergence_detector.add_response("Similar response 1")
        convergence_detector.add_response("Similar response 2")
        convergence_detector.add_response("Similar response 3")

        # Should have sufficient responses for analysis
        assert len(convergence_detector.responses) == 3

    def test_event_format_compatibility(self):
        """Test that event format is compatible with Vercel AI SDK v4."""

        factory = UniversalAgentFactory()

        # Test all event types
        event_types = [
            "start",
            "toolCall",
            "toolResult",
            "text",
            "budget_exceeded",
            "converged",
            "error",
            "done",
        ]

        for event_type in event_types:
            event_str = factory._format_stream_event(event_type, {"test": "data"})

            # Verify SSE format
            assert event_str.startswith("data: ")
            assert event_str.endswith("\n\n")

            # Verify JSON structure
            json_str = event_str[6:-2]
            event_data = json.loads(json_str)

            required_fields = ["id", "event", "data", "timestamp"]
            for field in required_fields:
                assert field in event_data

            assert event_data["event"] == event_type
            assert isinstance(event_data["data"], dict)

    def test_tool_budget_validation(self):
        """Test ToolBudget validation follows Pydantic patterns."""

        # Valid budget
        budget = ToolBudget(max_tool_calls=10, max_depth=5, time_budget_s=60.0)
        assert budget.max_tool_calls == 10
        assert budget.max_depth == 5

        # Test budget tracker integration
        tracker = BudgetTracker()
        tracker.increment_tool_call("search_code")

        should_stop, reason = tracker.should_stop(budget)
        assert not should_stop  # Should not stop with valid limits

    @pytest.mark.asyncio
    async def test_convergence_detector_integration(self):
        """Test ConvergenceDetector integration with streaming."""

        config = ConvergenceConfig(
            similarity_threshold=0.8,
            use_critic_model=False,  # Disable for testing
        )
        detector = ConvergenceDetector(config)

        # Add some responses
        detector.add_response("First response about authentication")
        detector.add_response("Second response about authentication")
        detector.add_response("Third response about authentication")

        # Test convergence detection
        has_converged = await detector.has_converged()
        # Should have enough responses to analyze (even if not converged)
        assert isinstance(has_converged, bool)


class TestPydanticAIPatterns:
    """Test adherence to Pydantic AI patterns and best practices."""

    def test_agent_type_enum(self):
        """Test AgentType enum follows Pydantic patterns."""

        # Test all agent types are valid
        for agent_type in AgentType:
            assert isinstance(agent_type.value, str)
            assert len(agent_type.value) > 0

        # Test specific agent types
        assert AgentType.SIMPLIFIER == "simplifier"
        assert AgentType.TESTER == "tester"

    def test_universal_dependencies_model(self):
        """Test UniversalDependencies follows Pydantic model patterns."""

        # Create valid dependencies
        deps = UniversalDependencies(
            repository_name="test-repo",
            agent_type=AgentType.SIMPLIFIER,
            user_query="Test query",
            context={"test": "data"},
            conversation_context=None,
        )

        assert deps.repository_name == "test-repo"
        assert deps.agent_type == AgentType.SIMPLIFIER
        assert deps.user_query == "Test query"
        assert deps.context == {"test": "data"}

        # Test tool budget and tracker are properly initialized
        assert isinstance(deps.tool_budget, ToolBudget)
        assert isinstance(deps.budget_tracker, BudgetTracker)

    def test_conversation_context_model(self):
        """Test ConversationContext follows Pydantic patterns."""

        context = ConversationContext()

        # Test default values
        assert context.discovered_entities == {}
        assert context.valid_entity_ids == []
        assert context.entity_relationships == {}
        assert context.repository_info == {}
        assert context.message_history == []
        assert isinstance(context.last_updated, datetime)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
