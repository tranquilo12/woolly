"""
Utilities for agent execution and optimization.

This module contains helper classes and functions for:
- Convergence detection and response similarity analysis
- Tool budget tracking and intelligent stopping criteria
- Response quality assessment and confidence scoring
"""

from .convergence import ConvergenceDetector

__all__ = ["ConvergenceDetector"]
