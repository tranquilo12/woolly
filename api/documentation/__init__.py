from .strategies.basic_strategy import BASIC_STRATEGY
from .strategies.api_strategy import API_STRATEGY
from .strategies import strategy_registry
import logging


def initialize_strategies():
    """Initialize all documentation strategies at startup"""
    try:
        strategy_registry.register(BASIC_STRATEGY)
        strategy_registry.register(API_STRATEGY)
        return True
    except Exception as e:
        logging.error(f"Failed to initialize documentation strategies: {e}")
        return False
