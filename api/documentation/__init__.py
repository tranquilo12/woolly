# Legacy strategy imports - removed in Phase 2
# from .strategies.basic_strategy import BASIC_STRATEGY
# from .strategies.api_strategy import API_STRATEGY
# from .strategies import strategy_registry
import logging


def initialize_strategies():
    """Initialize all documentation strategies at startup - Legacy function"""
    # Strategy system removed in Phase 2 - using new DocumentationAgentFactory
    logging.info("Strategy system deprecated - using DocumentationAgentFactory")
    return True
