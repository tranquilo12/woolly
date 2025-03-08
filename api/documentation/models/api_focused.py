from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class APIEndpoint(BaseModel):
    """Model for individual API endpoint documentation"""

    path: str
    method: str
    description: str
    parameters: Dict[str, Any]
    request_body: Optional[Dict[str, Any]]
    responses: Dict[str, Dict[str, Any]]
    auth_required: bool = False
    model_config = ConfigDict(arbitrary_types_allowed=True)


class ApiOverview(BaseModel):
    """API overview documentation section"""

    purpose: str = Field(description="The purpose and goals of the API")
    architecture: str = Field(description="High-level architecture of the API")
    design_decisions: List[str] = Field(
        description="Key design decisions made during API development"
    )
    technologies: List[str] = Field(description="Core technologies used in the API")
    versioning_strategy: str = Field(description="How API versioning is handled")


class EndpointDocumentation(BaseModel):
    """API endpoint documentation section"""

    endpoints: List[Dict[str, str]] = Field(
        description="List of API endpoints with details"
    )
    authentication: str = Field(
        description="Authentication methods supported by the API"
    )
    rate_limiting: Optional[str] = Field(
        description="Rate limiting policies if applicable"
    )
    error_handling: str = Field(description="How errors are handled and communicated")


class DataModels(BaseModel):
    """API data models documentation section"""

    models: List[Dict[str, str]] = Field(description="Data models used by the API")
    schemas: Dict[str, Dict] = Field(
        description="JSON schemas for request/response objects"
    )
    relationships: Optional[str] = Field(
        description="Relationships between data models"
    )
    validation_rules: Optional[str] = Field(
        description="Validation rules applied to data"
    )


class EndpointAnalysis(BaseModel):
    """Detailed API endpoint documentation"""

    endpoints: List[APIEndpoint]
    common_patterns: List[str]
    request_examples: Dict[str, Dict[str, Any]]
    response_examples: Dict[str, Dict[str, Any]]
    error_codes: Dict[str, str]
    relationships_diagram: str = Field(
        description="Mermaid diagram showing endpoint relationships"
    )


class SecurityDocumentation(BaseModel):
    """API security documentation"""

    authentication_flows: Dict[str, str]
    authorization_levels: List[str]
    security_protocols: List[str]
    token_handling: Dict[str, str]
    encryption_methods: List[str]
    security_headers: Dict[str, str]
    best_practices: List[str]
    security_diagram: str = Field(
        description="Mermaid diagram of security architecture"
    )


class IntegrationGuide(BaseModel):
    """API integration guide documentation section"""

    getting_started: str = Field(description="Getting started with the API")
    authentication_guide: str = Field(description="Detailed guide on authentication")
    common_use_cases: List[Dict[str, str]] = Field(
        description="Common integration scenarios"
    )
    best_practices: List[str] = Field(description="Best practices for API integration")
    troubleshooting: Dict[str, str] = Field(description="Common issues and solutions")


class APIMaintenanceOps(BaseModel):
    """API maintenance and operations documentation"""

    monitoring_setup: Dict[str, str]
    health_checks: List[Dict[str, str]]
    backup_procedures: List[str]
    scaling_guidelines: str
    incident_response: Dict[str, str]
    performance_metrics: List[str]
    troubleshooting_guide: Dict[str, List[str]]
    maintenance_schedule: Dict[str, str]
    operations_diagram: str = Field(
        description="Mermaid diagram of operational architecture"
    )


class ApiDocumentationResult(BaseModel):
    """Complete API documentation result"""

    api_overview: ApiOverview
    endpoint_documentation: EndpointDocumentation
    data_models: DataModels
    integration_guide: IntegrationGuide
