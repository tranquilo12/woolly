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


class APIOverview(BaseModel):
    """High-level API documentation overview"""

    title: str
    version: str
    description: str
    base_url: str
    authentication_methods: List[str]
    architecture_diagram: str = Field(description="Mermaid diagram of API architecture")
    core_technologies: List[str]
    global_headers: Optional[Dict[str, str]]
    rate_limits: Optional[Dict[str, str]]


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
    """API integration documentation"""

    setup_steps: List[str]
    authentication_setup: Dict[str, str]
    basic_usage_examples: Dict[str, str]
    advanced_patterns: List[Dict[str, str]]
    error_handling: Dict[str, str]
    rate_limiting_guide: str
    environment_setup: Dict[str, str]
    testing_guide: str
    integration_diagram: str = Field(
        description="Mermaid diagram showing integration flow"
    )


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
