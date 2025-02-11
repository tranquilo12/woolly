from ..models.api_focused import (
    APIOverview,
    EndpointAnalysis,
    SecurityDocumentation,
    IntegrationGuide,
    APIMaintenanceOps,
)
from ..strategies import DocumentationStrategy, StepConfig, register_strategy

API_STRATEGY = DocumentationStrategy(
    name="api_focused",
    description="Documentation strategy focused on API documentation",
    steps=[
        StepConfig(
            id=1,
            title="API Overview",
            prompt="Generate a comprehensive API overview including endpoints, authentication, and data models.",
            model="APIOverview",
        ),
        StepConfig(
            id=2,
            title="Endpoint Analysis",
            prompt="Document each API endpoint, parameters, responses, and examples.",
            model="EndpointAnalysis",
        ),
        StepConfig(
            id=3,
            title="Security Documentation",
            prompt="Document API security measures, authentication, and authorization.",
            model="SecurityDocumentation",
        ),
        StepConfig(
            id=4,
            title="Integration Guide",
            prompt="Create API integration guides with examples and best practices.",
            model="IntegrationGuide",
        ),
        StepConfig(
            id=5,
            title="API Operations",
            prompt="Document API maintenance, monitoring, and troubleshooting.",
            model="APIMaintenanceOps",
        ),
    ],
    models={
        "APIOverview": APIOverview,
        "EndpointAnalysis": EndpointAnalysis,
        "SecurityDocumentation": SecurityDocumentation,
        "IntegrationGuide": IntegrationGuide,
        "APIMaintenanceOps": APIMaintenanceOps,
    },
)

# Use register_strategy function instead of calling register method
register_strategy(API_STRATEGY)
