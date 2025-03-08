# Create separate files for different documentation strategies
from .basic import (
    SystemOverview,
    ComponentAnalysis,
    CodeDocumentation,
    DevelopmentGuide,
    MaintenanceOps,
    DocumentationResult,
)

from .api_focused import (
    ApiOverview,
    EndpointDocumentation,
    DataModels,
    IntegrationGuide,
    ApiDocumentationResult,
)

__all__ = [
    "SystemOverview",
    "ComponentAnalysis",
    "CodeDocumentation",
    "DevelopmentGuide",
    "MaintenanceOps",
    "DocumentationResult",
    "ApiOverview",
    "EndpointDocumentation",
    "DataModels",
    "IntegrationGuide",
    "ApiDocumentationResult",
]
