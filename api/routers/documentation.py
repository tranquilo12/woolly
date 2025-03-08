from fastapi import APIRouter, HTTPException, status
from ..documentation.strategies import strategy_registry
from typing import Dict, List

router = APIRouter()


@router.get("/strategies", response_model=List[Dict])
async def list_strategies():
    """List all available documentation strategies"""
    try:
        strategies = strategy_registry.values()
        if not strategies:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Documentation strategies not initialized",
            )
        return [
            {
                "name": strategy.name,
                "description": strategy.description,
                "steps": len(strategy.steps),
            }
            for strategy in strategies
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch strategies: {str(e)}",
        )


@router.get("/strategies/{strategy_name}")
async def get_strategy_details(strategy_name: str):
    """Get detailed information about a specific strategy"""
    strategy = strategy_registry.get(strategy_name)
    if not strategy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Strategy '{strategy_name}' not found",
        )
    return {
        "name": strategy.name,
        "description": strategy.description,
        "steps": [
            {
                "id": step.id,
                "title": step.title,
                "prompt": step.prompt,
                "model": step.model,
            }
            for step in strategy.steps
        ],
    }
