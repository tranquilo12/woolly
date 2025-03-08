from typing import Dict, Type, List, Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class StepConfig(BaseModel):
    """Configuration for a documentation step"""

    id: int
    title: str
    prompt: str
    model: str
    # Add fields for graph-based flows
    next_steps: List[int] = Field(
        default_factory=list, description="IDs of the next steps in the flow"
    )
    child_steps: List[int] = Field(
        default_factory=list,
        description="IDs of child steps that can be added to this step",
    )
    parent_id: Optional[int] = Field(
        default=None, description="ID of the parent step if this is a child step"
    )
    position: Dict[str, float] = Field(
        default_factory=dict,
        description="Position of the step in the flow visualization",
    )


class DocumentationStrategy(BaseModel):
    """Base class for documentation strategies"""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    name: str
    description: str
    steps: List[StepConfig]
    models: Dict[str, Type[BaseModel]]
    # Add field for versioning
    version: str = Field(default="1.0.0", description="Version of the strategy")


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
