from typing import Dict, Type, List

from pydantic import BaseModel


class StepConfig(BaseModel):
    """Pydantic model for step configuration"""

    id: int
    title: str
    prompt: str
    model: str
    system_prompt: str | None = None


class DocumentationStrategy(BaseModel):
    """Pydantic model for documentation strategy configuration"""

    name: str
    description: str
    steps: List[StepConfig]
    models: Dict[str, Type[BaseModel]]



# Create registry
strategy_registry = {}


def register_strategy(strategy: DocumentationStrategy):
    """Register a documentation strategy"""
    strategy_registry[strategy.name] = strategy
