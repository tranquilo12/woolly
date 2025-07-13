#!/usr/bin/env python3
"""
Tests for ToolBudget and BudgetTracker models
============================================

Comprehensive test suite for Phase 5 tool budget implementation.
Tests all stopping criteria and budget tracking functionality.
"""

import pytest
import time
from datetime import datetime, timedelta
from api.agents.universal import ToolBudget, BudgetTracker


class TestToolBudget:
    """Test ToolBudget model validation and defaults"""

    def test_default_values(self):
        """Test that ToolBudget has sensible defaults"""
        budget = ToolBudget()

        assert budget.max_tool_calls == 10
        assert budget.max_depth == 3
        assert budget.time_budget_s == 120.0
        assert budget.convergence_threshold == 0.8
        assert budget.convergence_window == 3
        assert budget.max_input_tokens == 50000
        assert budget.max_output_tokens == 20000
        assert budget.min_confidence == 0.3
        assert budget.max_search_calls == 5
        assert budget.max_qa_calls == 3
        assert budget.max_entity_calls == 4

    def test_validation_constraints(self):
        """Test Pydantic validation constraints"""
        # Test valid values
        budget = ToolBudget(
            max_tool_calls=5,
            max_depth=2,
            time_budget_s=60.0,
            convergence_threshold=0.9,
            min_confidence=0.5,
        )
        assert budget.max_tool_calls == 5
        assert budget.max_depth == 2

        # Test invalid values
        with pytest.raises(ValueError):
            ToolBudget(max_tool_calls=0)  # Below minimum

        with pytest.raises(ValueError):
            ToolBudget(max_tool_calls=100)  # Above maximum

        with pytest.raises(ValueError):
            ToolBudget(convergence_threshold=1.5)  # Above 1.0

        with pytest.raises(ValueError):
            ToolBudget(time_budget_s=0.5)  # Below minimum (now 1.0)

    def test_post_init_validation(self):
        """Test custom validation in __post_init__"""
        # Valid: max_tool_calls >= max_depth
        budget = ToolBudget(max_tool_calls=5, max_depth=3)
        assert budget.max_tool_calls == 5

        # Invalid: max_tool_calls < max_depth
        with pytest.raises(ValueError, match="max_tool_calls must be >= max_depth"):
            ToolBudget(max_tool_calls=2, max_depth=5)


class TestBudgetTracker:
    """Test BudgetTracker functionality"""

    def test_initialization(self):
        """Test BudgetTracker initializes correctly"""
        tracker = BudgetTracker()

        assert tracker.tool_calls_made == 0
        assert tracker.current_depth == 0
        assert tracker.input_tokens_used == 0
        assert tracker.output_tokens_used == 0
        assert tracker.search_calls_made == 0
        assert tracker.qa_calls_made == 0
        assert tracker.entity_calls_made == 0
        assert len(tracker.recent_responses) == 0
        assert len(tracker.confidence_scores) == 0
        assert isinstance(tracker.start_time, datetime)

    def test_increment_tool_call(self):
        """Test tool call increment tracking"""
        tracker = BudgetTracker()

        # Test general increment
        tracker.increment_tool_call("unknown_tool")
        assert tracker.tool_calls_made == 1
        assert tracker.search_calls_made == 0

        # Test specific tool tracking
        tracker.increment_tool_call("search_code")
        assert tracker.tool_calls_made == 2
        assert tracker.search_calls_made == 1

        tracker.increment_tool_call("qa_codebase")
        assert tracker.tool_calls_made == 3
        assert tracker.qa_calls_made == 1

        tracker.increment_tool_call("find_entities")
        assert tracker.tool_calls_made == 4
        assert tracker.entity_calls_made == 1

    def test_add_response(self):
        """Test response and confidence tracking"""
        tracker = BudgetTracker()

        tracker.add_response("First response", 0.9)
        assert len(tracker.recent_responses) == 1
        assert len(tracker.confidence_scores) == 1
        assert tracker.confidence_scores[0] == 0.9

        # Add multiple responses
        for i in range(15):  # More than max window (10)
            tracker.add_response(f"Response {i}", 0.8)

        # Should only keep last 10
        assert len(tracker.recent_responses) == 10
        assert len(tracker.confidence_scores) == 10
        assert tracker.recent_responses[-1] == "Response 14"

    def test_elapsed_time(self):
        """Test elapsed time calculation"""
        tracker = BudgetTracker()

        # Should be very small initially
        elapsed = tracker.get_elapsed_time()
        assert elapsed < 1.0

        # Simulate time passing
        time.sleep(0.1)
        elapsed = tracker.get_elapsed_time()
        assert elapsed >= 0.1

    def test_should_stop_basic_limits(self):
        """Test basic stopping criteria"""
        budget = ToolBudget(
            max_tool_calls=2, max_depth=1, time_budget_s=2.0
        )  # Use 2.0 seconds
        tracker = BudgetTracker()

        # Should not stop initially
        should_stop, reason = tracker.should_stop(budget)
        assert not should_stop
        assert reason == ""

        # Test max tool calls
        tracker.tool_calls_made = 2
        should_stop, reason = tracker.should_stop(budget)
        assert should_stop
        assert "max tool calls" in reason

        # Reset and test max depth
        tracker.tool_calls_made = 0
        tracker.current_depth = 1
        should_stop, reason = tracker.should_stop(budget)
        assert should_stop
        assert "max depth" in reason

        # Reset and test time budget
        tracker.current_depth = 0
        tracker.start_time = datetime.now() - timedelta(seconds=3)  # 3 seconds ago
        should_stop, reason = tracker.should_stop(budget)
        assert should_stop
        assert "time budget" in reason

    def test_should_stop_token_limits(self):
        """Test token-based stopping criteria"""
        budget = ToolBudget(
            max_input_tokens=1000, max_output_tokens=500
        )  # Use larger values
        tracker = BudgetTracker()

        # Test input token limit
        tracker.input_tokens_used = 1000
        should_stop, reason = tracker.should_stop(budget)
        assert should_stop
        assert "input token limit" in reason

        # Reset and test output token limit
        tracker.input_tokens_used = 0
        tracker.output_tokens_used = 500
        should_stop, reason = tracker.should_stop(budget)
        assert should_stop
        assert "output token limit" in reason

    def test_should_stop_tool_specific_limits(self):
        """Test tool-specific stopping criteria"""
        budget = ToolBudget(max_search_calls=1, max_qa_calls=1, max_entity_calls=1)
        tracker = BudgetTracker()

        # Test search calls limit
        tracker.search_calls_made = 1
        should_stop, reason = tracker.should_stop(budget)
        assert should_stop
        assert "search calls limit" in reason

        # Reset and test QA calls limit
        tracker.search_calls_made = 0
        tracker.qa_calls_made = 1
        should_stop, reason = tracker.should_stop(budget)
        assert should_stop
        assert "QA calls limit" in reason

        # Reset and test entity calls limit
        tracker.qa_calls_made = 0
        tracker.entity_calls_made = 1
        should_stop, reason = tracker.should_stop(budget)
        assert should_stop
        assert "entity calls limit" in reason

    def test_should_stop_confidence_threshold(self):
        """Test confidence-based stopping"""
        budget = ToolBudget(min_confidence=0.7)
        tracker = BudgetTracker()

        # Add responses with low confidence
        tracker.add_response("Response 1", 0.5)
        tracker.add_response("Response 2", 0.4)
        tracker.add_response("Response 3", 0.3)

        should_stop, reason = tracker.should_stop(budget)
        assert should_stop
        assert "Confidence below threshold" in reason

        # Reset with high confidence
        tracker.confidence_scores = [0.8, 0.9, 0.85]
        should_stop, reason = tracker.should_stop(budget)
        assert not should_stop

    def test_calculate_similarity(self):
        """Test text similarity calculation"""
        tracker = BudgetTracker()

        # Identical texts
        similarity = tracker._calculate_similarity("hello world", "hello world")
        assert similarity == 1.0

        # Completely different texts
        similarity = tracker._calculate_similarity("hello world", "foo bar")
        assert similarity == 0.0

        # Partially similar texts
        similarity = tracker._calculate_similarity(
            "hello world test", "hello world example"
        )
        assert 0.0 < similarity < 1.0

        # Empty texts
        similarity = tracker._calculate_similarity("", "hello")
        assert similarity == 0.0

        similarity = tracker._calculate_similarity("hello", "")
        assert similarity == 0.0

    def test_check_convergence(self):
        """Test convergence detection"""
        budget = ToolBudget(
            convergence_threshold=0.7, convergence_window=3
        )  # Lower threshold
        tracker = BudgetTracker()

        # Not enough responses
        tracker.recent_responses = ["Response 1", "Response 2"]
        assert not tracker._check_convergence(budget)

        # Similar responses (should converge)
        tracker.recent_responses = [
            "The authentication system uses JWT tokens",
            "The authentication system uses JWT tokens for security",
            "The authentication system implements JWT tokens",
        ]
        assert tracker._check_convergence(budget)

        # Different responses (should not converge)
        tracker.recent_responses = [
            "The authentication system uses JWT tokens",
            "The database schema has user tables",
            "The frontend uses React components",
        ]
        assert not tracker._check_convergence(budget)


class TestIntegration:
    """Integration tests for ToolBudget and BudgetTracker"""

    def test_realistic_scenario(self):
        """Test a realistic agent execution scenario"""
        budget = ToolBudget(
            max_tool_calls=5,
            max_search_calls=2,
            max_qa_calls=2,
            convergence_threshold=0.7,
        )
        tracker = BudgetTracker()

        # Simulate agent execution
        tools_to_call = ["search_code", "search_code", "qa_codebase", "find_entities"]
        responses = [
            "Found authentication code in auth.py",
            "Found similar authentication code in middleware.py",
            "The authentication system uses JWT tokens",
            "Discovered User and Session entities",
        ]

        for i, (tool, response) in enumerate(zip(tools_to_call, responses)):
            # Check if we should stop before the tool call
            should_stop, reason = tracker.should_stop(budget)
            if should_stop:
                print(f"Stopped at step {i}: {reason}")
                break

            # Execute tool call
            tracker.increment_tool_call(tool)
            tracker.add_response(response, confidence=0.8)

        # Should have made some progress but respected limits
        assert tracker.tool_calls_made <= budget.max_tool_calls
        assert tracker.search_calls_made <= budget.max_search_calls
        assert tracker.qa_calls_made <= budget.max_qa_calls

    def test_convergence_scenario(self):
        """Test scenario where agent converges on similar responses"""
        budget = ToolBudget(convergence_threshold=0.6, convergence_window=3)
        tracker = BudgetTracker()

        # Add converging responses
        similar_responses = [
            "The system uses JWT authentication",
            "The system implements JWT authentication",
            "The system has JWT authentication",
        ]

        for response in similar_responses:
            tracker.add_response(response, confidence=0.8)

        should_stop, reason = tracker.should_stop(budget)
        assert should_stop
        assert "converged" in reason


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
