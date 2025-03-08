from typing import Dict, Type
from pydantic import BaseModel
from .. import models
from . import DocumentationStrategy, StepConfig, register_strategy

BASIC_STRATEGY = DocumentationStrategy(
    name="basic",
    description="Basic 5-step documentation strategy",
    version="1.0.0",
    steps=[
        StepConfig(
            id=1,
            title="System Overview",
            prompt="Generate a comprehensive system overview including architecture diagrams, core technologies, and key design patterns.",
            model="SystemOverview",
            system_prompt="You are a system architect specialized in creating comprehensive system documentation. Focus on high-level architecture, core technologies, and design patterns.",
            next_steps=[2],
            position={"x": 0, "y": 0},
        ),
        StepConfig(
            id=2,
            title="Component Analysis",
            prompt="Analyze each major component's structure, dependencies, and technical details.",
            model="ComponentAnalysis",
            system_prompt="You are a system analyst specialized in analyzing system components. Focus on structure, dependencies, and technical details.",
            next_steps=[3],
            position={"x": 200, "y": 0},
        ),
        StepConfig(
            id=3,
            title="Code Documentation",
            prompt="Document significant code modules, their purposes, and usage patterns.",
            model="CodeDocumentation",
            system_prompt="You are a software developer specialized in documenting code modules. Focus on purposes and usage patterns.",
            next_steps=[4],
            position={"x": 400, "y": 0},
        ),
        StepConfig(
            id=4,
            title="Development Guides",
            prompt="Create development setup instructions and workflow documentation.",
            model="DevelopmentGuide",
            system_prompt="You are a software developer specialized in creating development setup instructions and workflow documentation. Focus on setup and workflow.",
            next_steps=[5],
            position={"x": 600, "y": 0},
        ),
        StepConfig(
            id=5,
            title="Maintenance & Operations",
            prompt="Document maintenance procedures, troubleshooting guides, and operational considerations.",
            model="MaintenanceOps",
            system_prompt="You are a system administrator specialized in documenting maintenance procedures and operational considerations. Focus on maintenance and operations.",
            next_steps=[],
            position={"x": 800, "y": 0},
        ),
    ],
    models={
        "SystemOverview": models.SystemOverview,
        "ComponentAnalysis": models.ComponentAnalysis,
        "CodeDocumentation": models.CodeDocumentation,
        "DevelopmentGuide": models.DevelopmentGuide,
        "MaintenanceOps": models.MaintenanceOps,
    },
)

# Register strategy using the function
register_strategy(BASIC_STRATEGY)
