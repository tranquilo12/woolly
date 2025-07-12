from fastapi import APIRouter, HTTPException
# Legacy strategy registry import - keeping for backward compatibility
try:
    from ..documentation.strategies import strategy_registry
except ImportError:
    # Strategy registry removed in Phase 2 - using fallback
    strategy_registry = {}
from pydantic import BaseModel
from typing import Dict, List, Any


class SerializedStep(BaseModel):
    """Serializable step configuration"""

    id: int
    title: str
    prompt: str
    model: str


class SerializedStrategy(BaseModel):
    """Serializable strategy configuration"""

    name: str
    description: str
    steps: List[SerializedStep]
    models: Dict[str, str]  # Store model names instead of types


router = APIRouter(prefix="/api/strategies", tags=["strategies"])


@router.get("")
async def list_strategies():
    """List all available documentation strategies"""
    strategies = []
    for name, strategy in (strategy_registry.items() if strategy_registry else []):
        strategies.append({"name": strategy.name, "description": strategy.description})
    return strategies


@router.get("/{strategy_name}")
async def get_strategy(strategy_name: str) -> SerializedStrategy:
    """Get details of a specific documentation strategy"""
    strategy = strategy_registry.get(strategy_name) if strategy_registry else None
    if not strategy:
        raise HTTPException(
            status_code=404, detail=f"Strategy '{strategy_name}' not found"
        )

    # Convert to serializable format
    return SerializedStrategy(
        name=strategy.name,
        description=strategy.description,
        steps=[SerializedStep(**step.model_dump()) for step in strategy.steps],
        models={
            name: model_type.__name__ for name, model_type in strategy.models.items()
        },
    )
