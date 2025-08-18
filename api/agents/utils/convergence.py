#!/usr/bin/env python3
"""
Convergence Detection Utility for Pydantic AI Agents
===================================================

This module provides sophisticated convergence detection to prevent infinite
agent exploration loops by analyzing response similarity patterns over time.

Features:
- Multi-algorithm similarity detection (Jaccard + AI Critic)
- Semantic similarity evaluation using small models
- Confidence-weighted convergence analysis
- Time-decay for response relevance
- Stability detection over time windows
- Quality threshold enforcement

Inspired by Ray Tune stopping criteria and following Pydantic AI best practices
from https://ai.pydantic.dev/llms-full.txt
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from pydantic import BaseModel, Field
import logging

# Pydantic AI imports for critic functionality
from pydantic_ai import Agent
from pydantic_ai.models import Model

logger = logging.getLogger(__name__)


@dataclass
class ResponseEntry:
    """Single response entry for convergence analysis."""

    content: str
    timestamp: datetime
    confidence: float = 0.8
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Validate response entry data."""
        if not self.content:
            raise ValueError("Response content cannot be empty")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("Confidence must be between 0.0 and 1.0")


class SimilarityMetrics(BaseModel):
    """Structured output for similarity analysis."""

    similarity: float = Field(
        ge=0.0, le=1.0, description="Semantic similarity score between responses"
    )
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence in the similarity assessment"
    )
    stability: float = Field(
        ge=0.0, le=1.0, description="Stability of response patterns"
    )
    quality: float = Field(ge=0.0, le=1.0, description="Overall quality assessment")


class ConvergenceConfig(BaseModel):
    """Configuration for convergence detection behavior."""

    # Window settings
    window_size: int = Field(
        default=3, ge=2, le=10, description="Number of responses to analyze"
    )
    min_responses: int = Field(
        default=2,
        ge=2,
        le=5,
        description="Minimum responses before checking convergence",
    )

    # Similarity thresholds
    similarity_threshold: float = Field(
        default=0.7, ge=0.5, le=1.0, description="Minimum similarity for convergence"
    )
    convergence_ratio: float = Field(
        default=0.6, ge=0.5, le=1.0, description="Ratio of similar pairs needed"
    )

    # Quality thresholds
    min_confidence: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="Minimum confidence to consider response",
    )
    confidence_decay: float = Field(
        default=0.1, ge=0.0, le=0.5, description="Confidence decay over time"
    )

    # Time-based settings
    max_age_minutes: int = Field(
        default=30, ge=1, le=120, description="Maximum age of responses to consider"
    )
    stability_window_seconds: int = Field(
        default=10, ge=5, le=60, description="Time window for stability check"
    )

    # Critic model settings
    use_critic_model: bool = Field(
        default=True, description="Enable AI critic for semantic similarity"
    )
    critic_model: str = Field(
        default="openai:gpt-4o-mini",
        description="Model for semantic similarity evaluation",
    )
    critic_weight: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Weight for critic vs Jaccard similarity",
    )

    def model_post_init(self, __context):
        """Validate configuration constraints."""
        if self.window_size < self.min_responses:
            raise ValueError("window_size must be >= min_responses")


class ConvergenceDetector:
    """
    Advanced convergence detection for agent responses.

    This class implements sophisticated algorithms to detect when agent responses
    have converged, preventing infinite exploration loops while maintaining
    response quality.

    Features:
    - Multi-algorithm similarity detection (Jaccard + AI Critic)
    - Semantic similarity evaluation using small models
    - Confidence-weighted convergence analysis
    - Time-decay for response relevance
    - Stability detection over time windows
    - Quality threshold enforcement
    """

    def __init__(self, config: Optional[ConvergenceConfig] = None):
        """Initialize convergence detector with optional configuration."""
        self.config = config or ConvergenceConfig()
        self.responses: List[ResponseEntry] = []
        self.similarity_cache: Dict[Tuple[int, int], float] = {}
        self.last_convergence_check: Optional[datetime] = None
        self.convergence_history: List[bool] = []

        # Initialize AI critic for semantic similarity
        self._init_critic_agent()

    def _init_critic_agent(self) -> None:
        """Initialize the AI critic agent for semantic similarity evaluation."""
        if not self.config.use_critic_model:
            self.critic_agent = None
            return

        try:
            self.critic_agent = Agent(
                model=self.config.critic_model,
                output_type=SimilarityMetrics,
                system_prompt="""You are a semantic similarity critic for AI agent responses.

Your task is to analyze two agent responses and determine how similar they are in meaning, intent, and content quality.

Consider these factors:
1. **Semantic Similarity**: Do the responses convey the same core information or intent?
2. **Content Overlap**: How much factual information is shared between responses?
3. **Quality Consistency**: Are both responses of similar quality and completeness?
4. **Stability**: Do the responses suggest the agent has reached a stable conclusion?

Provide scores from 0.0 to 1.0 for each metric:
- similarity: 0.0 = completely different, 1.0 = essentially identical
- confidence: 0.0 = uncertain assessment, 1.0 = very confident
- stability: 0.0 = responses suggest continued exploration needed, 1.0 = stable conclusion reached
- quality: 0.0 = poor quality responses, 1.0 = high quality responses

Be precise and consider both surface-level and deep semantic similarities.""",
            )
            logger.info("✅ AI critic agent initialized successfully")
        except Exception as e:
            logger.warning(
                f"⚠️ Failed to initialize AI critic: {e}. Falling back to Jaccard only."
            )
            self.critic_agent = None

    def add_response(
        self,
        content: str,
        confidence: float = 0.8,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Add a new response to the convergence analysis.

        Args:
            content: The response content to analyze
            confidence: Confidence score for this response
            metadata: Optional metadata about the response
        """
        entry = ResponseEntry(
            content=content,
            timestamp=datetime.now(),
            confidence=confidence,
            metadata=metadata or {},
        )

        self.responses.append(entry)
        logger.debug(
            f"Added response to convergence detector. Total responses: {len(self.responses)}"
        )

        # Clean up old responses periodically
        if len(self.responses) % 5 == 0:
            self._cleanup_old_responses()

    async def has_converged(self, force_check: bool = False) -> bool:
        """
        Check if responses have converged based on multiple signals.

        Args:
            force_check: Skip rate limiting and force convergence check

        Returns:
            True if convergence detected, False otherwise
        """
        # Rate limiting check
        if not force_check and self._should_skip_check():
            return False

        # Minimum response requirement
        if len(self.responses) < self.config.min_responses:
            return False

        self.last_convergence_check = datetime.now()

        # Get recent responses for analysis
        recent_responses = self._get_recent_responses()
        if len(recent_responses) < self.config.min_responses:
            return False

        # Calculate convergence signals
        signals = await self._calculate_convergence_signals(recent_responses)

        # Make convergence decision
        has_converged = self._make_convergence_decision(signals)

        # Track convergence history
        self.convergence_history.append(has_converged)
        if len(self.convergence_history) > 10:
            self.convergence_history.pop(0)

        logger.info(f"Convergence check: {has_converged} (signals: {signals})")

        return has_converged

    async def get_convergence_analysis(self) -> Dict[str, Any]:
        """
        Get detailed convergence analysis for debugging and monitoring.

        Returns:
            Dictionary containing convergence metrics and analysis
        """
        recent_responses = self._get_recent_responses()

        if len(recent_responses) < 2:
            return {
                "status": "insufficient_data",
                "response_count": len(self.responses),
                "recent_count": len(recent_responses),
                "signals": {},
                "convergence_history": self.convergence_history,
            }

        signals = await self._calculate_convergence_signals(recent_responses)

        return {
            "status": "analyzed",
            "response_count": len(self.responses),
            "recent_count": len(recent_responses),
            "config": self.config.model_dump(),
            "signals": signals,
            "convergence_decision": self._make_convergence_decision(signals),
            "convergence_history": self.convergence_history,
            "last_check": (
                self.last_convergence_check.isoformat()
                if self.last_convergence_check
                else None
            ),
            "cache_size": len(self.similarity_cache),
            "recent_responses": [
                {
                    "content_preview": (
                        r.content[:100] + "..." if len(r.content) > 100 else r.content
                    ),
                    "timestamp": r.timestamp.isoformat(),
                    "confidence": r.confidence,
                    "metadata": r.metadata,
                }
                for r in recent_responses
            ],
        }

    def reset(self) -> None:
        """Reset the convergence detector state."""
        self.responses.clear()
        self.similarity_cache.clear()
        self.convergence_history.clear()
        self.last_convergence_check = None
        logger.info("Convergence detector reset")

    def _get_recent_responses(self) -> List[ResponseEntry]:
        """Get recent responses within the configured window."""
        if not self.responses:
            return []

        # Sort by timestamp (most recent first)
        sorted_responses = sorted(
            self.responses, key=lambda r: r.timestamp, reverse=True
        )

        # Take the most recent responses up to window_size
        recent = sorted_responses[: self.config.window_size]

        # Filter by age
        cutoff_time = datetime.now() - timedelta(minutes=self.config.max_age_minutes)
        return [r for r in recent if r.timestamp >= cutoff_time]

    async def _calculate_convergence_signals(
        self, responses: List[ResponseEntry]
    ) -> Dict[str, float]:
        """Calculate all convergence signals for the given responses."""
        signals = {}

        # Traditional similarity check
        signals["similarity"] = await self._check_similarity_convergence(responses)

        # Confidence-based signals
        signals["confidence"] = self._check_confidence_convergence(responses)

        # Temporal stability
        signals["stability"] = self._check_temporal_stability(responses)

        # Quality threshold
        signals["quality"] = self._check_quality_threshold(responses)

        return signals

    async def _check_similarity_convergence(
        self, responses: List[ResponseEntry]
    ) -> float:
        """Check convergence based on response similarity."""
        if len(responses) < 2:
            return 0.0

        similarities = []
        for i in range(len(responses)):
            for j in range(i + 1, len(responses)):
                similarity = await self._calculate_similarity(
                    responses[i], responses[j]
                )
                similarities.append(similarity)

        if not similarities:
            return 0.0

        # Calculate ratio of similarities above threshold
        above_threshold = sum(
            1 for s in similarities if s >= self.config.similarity_threshold
        )
        ratio = above_threshold / len(similarities)

        return ratio

    def _check_confidence_convergence(self, responses: List[ResponseEntry]) -> float:
        """Check convergence based on confidence stability."""
        if len(responses) < 2:
            return 0.0

        confidences = [r.confidence for r in responses]
        mean_confidence = sum(confidences) / len(confidences)

        # Check if all confidences are above minimum
        if mean_confidence < self.config.min_confidence:
            return 0.0

        # Calculate confidence stability (low variance = high stability)
        variance = sum((c - mean_confidence) ** 2 for c in confidences) / len(
            confidences
        )
        stability = max(0.0, 1.0 - variance * 10)  # Scale variance to 0-1 range

        return stability

    def _check_temporal_stability(self, responses: List[ResponseEntry]) -> float:
        """Check convergence based on temporal patterns."""
        if len(responses) < 2:
            return 0.0

        # Sort by timestamp
        sorted_responses = sorted(responses, key=lambda r: r.timestamp)

        # Check if responses are within stability window
        time_span = (
            sorted_responses[-1].timestamp - sorted_responses[0].timestamp
        ).total_seconds()
        stability_window = self.config.stability_window_seconds

        if time_span <= stability_window:
            # Recent responses within window suggest stability
            return 1.0

        # Calculate time-based decay
        decay_factor = max(
            0.0, 1.0 - (time_span - stability_window) / (stability_window * 2)
        )
        return decay_factor

    def _check_quality_threshold(self, responses: List[ResponseEntry]) -> float:
        """Check if responses meet quality thresholds."""
        if not responses:
            return 0.0

        # Check minimum confidence threshold
        above_threshold = sum(
            1 for r in responses if r.confidence >= self.config.min_confidence
        )
        quality_ratio = above_threshold / len(responses)

        # Apply quality bonus for high-confidence responses
        high_confidence = sum(1 for r in responses if r.confidence >= 0.8)
        bonus = min(0.2, high_confidence / len(responses) * 0.2)

        return min(1.0, quality_ratio + bonus)

    def _make_convergence_decision(self, signals: Dict[str, float]) -> bool:
        """Make final convergence decision based on all signals."""
        # Weighted combination of signals
        weights = {
            "similarity": 0.4,  # Most important
            "confidence": 0.25,
            "stability": 0.2,
            "quality": 0.15,
        }

        weighted_score = sum(
            signals.get(signal, 0.0) * weight for signal, weight in weights.items()
        )

        # Convergence threshold
        convergence_threshold = 0.6

        # Additional check: require minimum similarity
        min_similarity_met = (
            signals.get("similarity", 0.0) >= self.config.convergence_ratio
        )

        return weighted_score >= convergence_threshold and min_similarity_met

    async def _calculate_similarity(
        self, response1: ResponseEntry, response2: ResponseEntry
    ) -> float:
        """Calculate similarity between two responses using hybrid approach."""
        # Create cache key
        key = (id(response1), id(response2))
        reverse_key = (id(response2), id(response1))

        # Check cache
        if key in self.similarity_cache:
            return self.similarity_cache[key]
        if reverse_key in self.similarity_cache:
            return self.similarity_cache[reverse_key]

        # Calculate Jaccard similarity (fast baseline)
        jaccard_sim = self._jaccard_similarity(response1.content, response2.content)

        # Calculate AI critic similarity (if available)
        critic_sim = await self._critic_similarity(response1.content, response2.content)

        # Combine similarities based on configuration
        if critic_sim is not None:
            # Weighted combination of Jaccard and AI critic
            combined_similarity = (
                jaccard_sim * (1 - self.config.critic_weight)
                + critic_sim * self.config.critic_weight
            )
        else:
            # Fallback to Jaccard only
            combined_similarity = jaccard_sim

        # Apply confidence weighting
        confidence_weight = min(response1.confidence, response2.confidence)
        weighted_similarity = combined_similarity * confidence_weight

        # Cache result
        self.similarity_cache[key] = weighted_similarity

        return weighted_similarity

    async def _critic_similarity(self, text1: str, text2: str) -> Optional[float]:
        """Calculate semantic similarity using AI critic model."""
        if not self.critic_agent or not text1 or not text2:
            return None

        try:
            prompt = f"""Analyze the semantic similarity between these two agent responses:

Response 1:
{text1[:1000]}  # Limit to prevent token overflow

Response 2:
{text2[:1000]}  # Limit to prevent token overflow

Evaluate their similarity, confidence in your assessment, stability indicators, and overall quality."""

            result = await self.critic_agent.run(prompt)

            # Extract similarity score from structured output
            if hasattr(result, "data") and hasattr(result.data, "similarity"):
                return result.data.similarity
            else:
                logger.warning("Unexpected critic agent response format")
                return None

        except Exception as e:
            logger.warning(f"AI critic similarity calculation failed: {e}")
            return None

    def _jaccard_similarity(self, text1: str, text2: str) -> float:
        """Calculate Jaccard similarity between two texts."""
        if not text1 or not text2:
            return 0.0

        # Normalize and tokenize
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())

        if not words1 or not words2:
            return 0.0

        # Jaccard similarity: intersection / union
        intersection = words1.intersection(words2)
        union = words1.union(words2)

        return len(intersection) / len(union) if union else 0.0

    def _cleanup_old_responses(self) -> None:
        """Remove responses that are too old to be relevant."""
        cutoff_time = datetime.now() - timedelta(
            minutes=self.config.max_age_minutes * 2
        )
        original_count = len(self.responses)

        self.responses = [r for r in self.responses if r.timestamp >= cutoff_time]

        cleaned_count = original_count - len(self.responses)
        if cleaned_count > 0:
            logger.debug(f"Cleaned up {cleaned_count} old responses")

        # Clear similarity cache if we removed responses
        if cleaned_count > 0:
            self.similarity_cache.clear()

    def _should_skip_check(self) -> bool:
        """Determine if convergence check should be skipped (rate limiting)."""
        if not self.last_convergence_check:
            return False

        time_since_check = (
            datetime.now() - self.last_convergence_check
        ).total_seconds()
        return time_since_check < self.config.stability_window_seconds
