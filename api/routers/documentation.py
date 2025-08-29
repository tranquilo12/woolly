from fastapi import APIRouter, HTTPException, status
from typing import Dict, List

router = APIRouter()


@router.get("/strategies", response_model=List[Dict])
async def list_strategies():
    """410 Gone - legacy strategies API removed."""
    raise HTTPException(
        status_code=410,
        detail={
            "error": "Endpoint deprecated",
            "message": "Use the universal agent documentation capabilities instead",
            "migration_guide": "/docs/api/endpoints-analysis.md",
        },
    )


@router.get("/strategies/{strategy_name}")
async def get_strategy_details(strategy_name: str):
    """410 Gone - legacy strategies API removed."""
    raise HTTPException(
        status_code=410,
        detail={
            "error": "Endpoint deprecated",
            "message": "Use the universal agent documentation capabilities instead",
            "migration_guide": "/docs/api/endpoints-analysis.md",
        },
    )
