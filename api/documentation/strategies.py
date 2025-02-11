from typing import Dict, Type, List, Any
from pydantic import BaseModel, ConfigDict


class StepConfig(BaseModel):
    """Configuration for a documentation step"""

    id: int
    title: str
    prompt: str
    model: str


class DocumentationStrategy(BaseModel):
    """Base class for documentation strategies"""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    name: str
    description: str
    steps: List[StepConfig]
    models: Dict[str, Type[BaseModel]]


class StrategyRegistry:
    """Registry for documentation strategies"""

    def __init__(self):
        self._strategies: Dict[str, DocumentationStrategy] = {}

    def register(self, strategy: DocumentationStrategy):
        self._strategies[strategy.name] = strategy

    def get_strategy(self, name: str) -> DocumentationStrategy:
        return self._strategies.get(name)

    def list_strategies(self) -> List[str]:
        return list(self._strategies.keys())


# Global registry instance
strategy_registry = StrategyRegistry()
