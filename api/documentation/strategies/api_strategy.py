from typing import Dict, Type
from pydantic import BaseModel
from .. import models
from . import DocumentationStrategy, StepConfig, register_strategy

API_STRATEGY = DocumentationStrategy(
    name="api_focused",
    description="API-focused documentation strategy",
    version="1.0.0",
    steps=[
        StepConfig(
            id=1,
            title="API Overview",
            prompt="Generate a comprehensive overview of the API including its purpose, architecture, and key design decisions.",
            model="ApiOverview",
            system_prompt="You are an API documentation specialist. Focus on creating a clear overview of the API's purpose, architecture, and design decisions.",
            next_steps=[2],
            position={"x": 0, "y": 0},
        ),
        StepConfig(
            id=2,
            title="Endpoint Documentation",
            prompt="Document all API endpoints, their parameters, request/response formats, and authentication requirements.",
            model="EndpointDocumentation",
            system_prompt="You are an API documentation specialist. Focus on documenting endpoints, parameters, request/response formats, and authentication requirements.",
            next_steps=[3],
            position={"x": 200, "y": 0},
        ),
        StepConfig(
            id=3,
            title="Data Models",
            prompt="Document the data models used by the API, including schemas, relationships, and validation rules.",
            model="DataModels",
            system_prompt="You are a data modeling specialist. Focus on documenting data models, schemas, relationships, and validation rules.",
            next_steps=[4],
            position={"x": 400, "y": 0},
        ),
        StepConfig(
            id=4,
            title="Integration Guide",
            prompt="Create a guide for integrating with the API, including authentication, rate limiting, and error handling.",
            model="IntegrationGuide",
            system_prompt="You are an API integration specialist. Focus on creating a guide for authentication, rate limiting, and error handling.",
            next_steps=[],
            position={"x": 600, "y": 0},
        ),
    ],
    models={
        "ApiOverview": models.ApiOverview,
        "EndpointDocumentation": models.EndpointDocumentation,
        "DataModels": models.DataModels,
        "IntegrationGuide": models.IntegrationGuide,
    },
)

# Register strategy using the function
register_strategy(API_STRATEGY)
