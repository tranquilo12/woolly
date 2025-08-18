#!/usr/bin/env python3
"""
Tests for Convergence Detection Utility
=======================================

Comprehensive test suite for the ConvergenceDetector class,
including AI critic functionality and fallback mechanisms.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

# Configure pytest-asyncio
pytest_asyncio.asyncio_mode = "auto"

from api.agents.utils.convergence import (
    ConvergenceDetector,
    ConvergenceConfig,
    ResponseEntry,
    SimilarityMetrics,
)


class TestResponseEntry:
    """Test ResponseEntry dataclass validation."""

    def test_valid_response_entry(self):
        """Test creating a valid ResponseEntry."""
        entry = ResponseEntry(
            content="Test response",
            timestamp=datetime.now(),
            confidence=0.8,
            metadata={"source": "test"},
        )
        assert entry.content == "Test response"
        assert 0.0 <= entry.confidence <= 1.0

    def test_empty_content_validation(self):
        """Test that empty content raises ValueError."""
        with pytest.raises(ValueError, match="Response content cannot be empty"):
            ResponseEntry(
                content="",
                timestamp=datetime.now(),
                confidence=0.8,
            )

    def test_invalid_confidence_validation(self):
        """Test that invalid confidence raises ValueError."""
        with pytest.raises(ValueError, match="Confidence must be between 0.0 and 1.0"):
            ResponseEntry(
                content="Test response",
                timestamp=datetime.now(),
                confidence=1.5,
            )


class TestSimilarityMetrics:
    """Test SimilarityMetrics Pydantic model."""

    def test_valid_similarity_metrics(self):
        """Test creating valid SimilarityMetrics."""
        metrics = SimilarityMetrics(
            similarity=0.8,
            confidence=0.9,
            stability=0.7,
            quality=0.85,
        )
        assert metrics.similarity == 0.8
        assert metrics.confidence == 0.9
        assert metrics.stability == 0.7
        assert metrics.quality == 0.85

    def test_invalid_similarity_metrics(self):
        """Test validation of SimilarityMetrics fields."""
        with pytest.raises(ValueError):
            SimilarityMetrics(
                similarity=1.5,  # Invalid: > 1.0
                confidence=0.9,
                stability=0.7,
                quality=0.85,
            )


class TestConvergenceConfig:
    """Test ConvergenceConfig validation and defaults."""

    def test_default_config(self):
        """Test default configuration values."""
        config = ConvergenceConfig()
        assert config.window_size == 3
        assert config.min_responses == 2
        assert config.similarity_threshold == 0.7
        assert config.convergence_ratio == 0.6
        assert config.use_critic_model is True
        assert config.critic_model == "openai:gpt-4o-mini"
        assert config.critic_weight == 0.7

    def test_custom_config(self):
        """Test custom configuration values."""
        config = ConvergenceConfig(
            window_size=5,
            similarity_threshold=0.8,
            use_critic_model=False,
            critic_weight=0.5,
        )
        assert config.window_size == 5
        assert config.similarity_threshold == 0.8
        assert config.use_critic_model is False
        assert config.critic_weight == 0.5

    def test_config_validation(self):
        """Test configuration validation constraints."""
        with pytest.raises(
            ValueError, match="Input should be greater than or equal to 2"
        ):
            ConvergenceConfig(window_size=1, min_responses=3)

    def test_critic_settings_validation(self):
        """Test critic-specific configuration validation."""
        # Valid critic weight
        config = ConvergenceConfig(critic_weight=0.5)
        assert config.critic_weight == 0.5

        # Invalid critic weight (should be caught by Pydantic)
        with pytest.raises(ValueError):
            ConvergenceConfig(critic_weight=1.5)


class TestConvergenceDetector:
    """Test ConvergenceDetector main functionality."""

    def test_initialization_default(self):
        """Test detector initialization with default config."""
        detector = ConvergenceDetector()
        assert detector.config.window_size == 3
        assert len(detector.responses) == 0
        assert len(detector.similarity_cache) == 0
        assert len(detector.convergence_history) == 0

    def test_initialization_custom_config(self):
        """Test detector initialization with custom config."""
        config = ConvergenceConfig(window_size=5, similarity_threshold=0.8)
        detector = ConvergenceDetector(config)
        assert detector.config.window_size == 5
        assert detector.config.similarity_threshold == 0.8

    @patch("api.agents.utils.convergence.Agent")
    def test_critic_agent_initialization_success(self, mock_agent_class):
        """Test successful AI critic agent initialization."""
        mock_agent = MagicMock()
        mock_agent_class.return_value = mock_agent

        config = ConvergenceConfig(use_critic_model=True)
        detector = ConvergenceDetector(config)

        assert detector.critic_agent is not None
        mock_agent_class.assert_called_once()

    @patch("api.agents.utils.convergence.Agent")
    def test_critic_agent_initialization_disabled(self, mock_agent_class):
        """Test AI critic agent initialization when disabled."""
        config = ConvergenceConfig(use_critic_model=False)
        detector = ConvergenceDetector(config)

        assert detector.critic_agent is None
        mock_agent_class.assert_not_called()

    @patch("api.agents.utils.convergence.Agent")
    def test_critic_agent_initialization_failure(self, mock_agent_class):
        """Test AI critic agent initialization failure fallback."""
        mock_agent_class.side_effect = Exception("Model initialization failed")

        config = ConvergenceConfig(use_critic_model=True)
        detector = ConvergenceDetector(config)

        assert detector.critic_agent is None

    def test_add_response(self):
        """Test adding responses to the detector."""
        detector = ConvergenceDetector()

        detector.add_response("First response", confidence=0.8)
        assert len(detector.responses) == 1
        assert detector.responses[0].content == "First response"
        assert detector.responses[0].confidence == 0.8

        detector.add_response(
            "Second response", confidence=0.9, metadata={"test": True}
        )
        assert len(detector.responses) == 2
        assert detector.responses[1].metadata == {"test": True}

    @pytest.mark.asyncio
    async def test_has_converged_insufficient_responses(self):
        """Test convergence check with insufficient responses."""
        detector = ConvergenceDetector()

        # No responses
        result = await detector.has_converged()
        assert result is False

        # One response (below minimum)
        detector.add_response("Single response")
        result = await detector.has_converged()
        assert result is False

    @pytest.mark.asyncio
    async def test_has_converged_with_similar_responses(self):
        """Test convergence detection with similar responses."""
        config = ConvergenceConfig(
            similarity_threshold=0.5,  # Use minimum allowed threshold
            convergence_ratio=0.5,
            use_critic_model=False,  # Disable for predictable testing
        )
        detector = ConvergenceDetector(config)

        # Add very similar responses with high overlap
        detector.add_response("authentication system uses JWT tokens", confidence=0.8)
        detector.add_response(
            "authentication system uses JWT tokens for security", confidence=0.9
        )
        detector.add_response(
            "JWT tokens authentication system security", confidence=0.85
        )

        result = await detector.has_converged()
        # Should converge due to similar content
        assert result is True

    @pytest.mark.asyncio
    async def test_has_converged_with_different_responses(self):
        """Test convergence detection with different responses."""
        config = ConvergenceConfig(
            similarity_threshold=0.7,
            use_critic_model=False,  # Disable for predictable testing
        )
        detector = ConvergenceDetector(config)

        # Add different responses
        detector.add_response("The system uses authentication", confidence=0.8)
        detector.add_response("Database connections are pooled", confidence=0.9)
        detector.add_response("Frontend uses React components", confidence=0.85)

        result = await detector.has_converged()
        # Should not converge due to different content
        assert result is False

    @pytest.mark.asyncio
    async def test_critic_similarity_success(self):
        """Test AI critic similarity calculation success."""
        mock_agent = AsyncMock()
        mock_result = MagicMock()
        mock_result.output = SimilarityMetrics(
            similarity=0.85,
            confidence=0.9,
            stability=0.8,
            quality=0.9,
        )
        mock_agent.run.return_value = mock_result

        detector = ConvergenceDetector()
        detector.critic_agent = mock_agent

        result = await detector._critic_similarity("text1", "text2")
        assert result == 0.85
        mock_agent.run.assert_called_once()

    @pytest.mark.asyncio
    async def test_critic_similarity_failure(self):
        """Test AI critic similarity calculation failure fallback."""
        mock_agent = AsyncMock()
        mock_agent.run.side_effect = Exception("API call failed")

        detector = ConvergenceDetector()
        detector.critic_agent = mock_agent

        result = await detector._critic_similarity("text1", "text2")
        assert result is None

    @pytest.mark.asyncio
    async def test_critic_similarity_no_agent(self):
        """Test AI critic similarity when agent is None."""
        detector = ConvergenceDetector()
        detector.critic_agent = None

        result = await detector._critic_similarity("text1", "text2")
        assert result is None

    @pytest.mark.asyncio
    async def test_hybrid_similarity_calculation(self):
        """Test hybrid similarity calculation combining Jaccard and critic."""
        mock_agent = AsyncMock()
        mock_result = MagicMock()
        mock_result.output = SimilarityMetrics(
            similarity=0.9,
            confidence=0.95,
            stability=0.8,
            quality=0.9,
        )
        mock_agent.run.return_value = mock_result

        config = ConvergenceConfig(critic_weight=0.7)
        detector = ConvergenceDetector(config)
        detector.critic_agent = mock_agent

        response1 = ResponseEntry("similar text content", datetime.now(), 0.8)
        response2 = ResponseEntry("similar text content", datetime.now(), 0.9)

        result = await detector._calculate_similarity(response1, response2)

        # Should be weighted combination of Jaccard (high for identical) and critic (0.9)
        # With confidence weighting (min of 0.8, 0.9 = 0.8)
        assert 0.7 <= result <= 1.0  # Reasonable range for similar content

    @pytest.mark.asyncio
    async def test_fallback_similarity_calculation(self):
        """Test similarity calculation fallback to Jaccard only."""
        detector = ConvergenceDetector()
        detector.critic_agent = None  # No critic available

        response1 = ResponseEntry("identical text", datetime.now(), 0.8)
        response2 = ResponseEntry("identical text", datetime.now(), 0.9)

        result = await detector._calculate_similarity(response1, response2)

        # Should use Jaccard only with confidence weighting
        expected_jaccard = 1.0  # Identical text
        expected_weighted = expected_jaccard * 0.8  # Min confidence
        assert result == expected_weighted

    def test_jaccard_similarity(self):
        """Test Jaccard similarity calculation."""
        detector = ConvergenceDetector()

        # Identical text
        result = detector._jaccard_similarity("hello world", "hello world")
        assert result == 1.0

        # Completely different text
        result = detector._jaccard_similarity("hello world", "foo bar")
        assert result == 0.0

        # Partial overlap
        result = detector._jaccard_similarity("hello world test", "hello world example")
        expected = 2 / 4  # 2 common words out of 4 total unique words
        assert result == expected

        # Empty text
        result = detector._jaccard_similarity("", "hello")
        assert result == 0.0

    @pytest.mark.asyncio
    async def test_convergence_analysis(self):
        """Test detailed convergence analysis output."""
        detector = ConvergenceDetector()

        # Add some responses
        detector.add_response("First response", confidence=0.8)
        detector.add_response("Second response", confidence=0.9)

        analysis = await detector.get_convergence_analysis()

        assert analysis["status"] == "analyzed"
        assert analysis["response_count"] == 2
        assert analysis["recent_count"] == 2
        assert "signals" in analysis
        assert "convergence_decision" in analysis
        assert "config" in analysis
        assert len(analysis["recent_responses"]) == 2

    @pytest.mark.asyncio
    async def test_convergence_analysis_insufficient_data(self):
        """Test convergence analysis with insufficient data."""
        detector = ConvergenceDetector()

        analysis = await detector.get_convergence_analysis()

        assert analysis["status"] == "insufficient_data"
        assert analysis["response_count"] == 0
        assert analysis["recent_count"] == 0

    def test_reset_detector(self):
        """Test resetting the detector state."""
        detector = ConvergenceDetector()

        # Add some data
        detector.add_response("Test response")
        detector.convergence_history.append(True)
        detector.similarity_cache[(1, 2)] = 0.5
        detector.last_convergence_check = datetime.now()

        # Reset
        detector.reset()

        assert len(detector.responses) == 0
        assert len(detector.similarity_cache) == 0
        assert len(detector.convergence_history) == 0
        assert detector.last_convergence_check is None

    def test_cleanup_old_responses(self):
        """Test cleanup of old responses."""
        config = ConvergenceConfig(max_age_minutes=1)  # Very short for testing
        detector = ConvergenceDetector(config)

        # Add old response
        old_time = datetime.now() - timedelta(minutes=5)
        old_response = ResponseEntry("Old response", old_time, 0.8)
        detector.responses.append(old_response)

        # Add recent response
        detector.add_response("Recent response")

        # Trigger cleanup
        detector._cleanup_old_responses()

        # Only recent response should remain
        assert len(detector.responses) == 1
        assert detector.responses[0].content == "Recent response"

    def test_should_skip_check_rate_limiting(self):
        """Test rate limiting for convergence checks."""
        config = ConvergenceConfig(stability_window_seconds=10)
        detector = ConvergenceDetector(config)

        # No previous check
        assert detector._should_skip_check() is False

        # Recent check within window
        detector.last_convergence_check = datetime.now()
        assert detector._should_skip_check() is True

        # Old check outside window
        detector.last_convergence_check = datetime.now() - timedelta(seconds=15)
        assert detector._should_skip_check() is False

    @pytest.mark.asyncio
    async def test_force_check_bypasses_rate_limiting(self):
        """Test that force_check bypasses rate limiting."""
        detector = ConvergenceDetector()
        detector.last_convergence_check = datetime.now()  # Recent check

        # Add sufficient responses
        detector.add_response("First response")
        detector.add_response("Second response")

        # Should normally be skipped due to rate limiting
        assert detector._should_skip_check() is True

        # But force_check should bypass it
        result = await detector.has_converged(force_check=True)
        assert isinstance(result, bool)  # Should return a result, not skip


if __name__ == "__main__":
    pytest.main([__file__])
