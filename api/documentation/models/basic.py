from pydantic import BaseModel, Field
from typing import List, Dict, Optional


class SystemOverview(BaseModel):
    """System overview documentation section"""

    architecture_diagram: str = Field(description="Mermaid diagram string")
    core_technologies: List[str]
    design_patterns: List[str]
    system_requirements: List[str]
    project_structure: str


class ComponentAnalysis(BaseModel):
    """Component analysis documentation section"""

    component_name: str
    description: str
    dependencies: List[str]


class CodeDocumentation(BaseModel):
    """Code documentation section"""

    code_module: str
    description: str
    usage_examples: List[str]


class DevelopmentGuide(BaseModel):
    """Development guide documentation section"""

    setup_instructions: str
    workflow_documentation: str


class MaintenanceOps(BaseModel):
    """Maintenance operations documentation section"""

    maintenance_procedures: str
    troubleshooting_guide: str


class DocumentationResult(BaseModel):

    system_overview: SystemOverview
    component_analysis: ComponentAnalysis
    code_documentation: CodeDocumentation
    development_guide: DevelopmentGuide
    maintenance_ops: MaintenanceOps

    @property
    def is_system_overview(self) -> bool:
        return isinstance(self, SystemOverview)

    @property
    def is_component_analysis(self) -> bool:
        return isinstance(self, ComponentAnalysis)

    @property
    def is_code_documentation(self) -> bool:
        return isinstance(self, CodeDocumentation)


class StepConfig(BaseModel):
    """Step configuration for documentation strategy"""

    id: int
    title: str
    prompt: str


class DocumentationStrategy(BaseModel):
    """Documentation strategy configuration"""

    name: str
    description: str
    steps: List[StepConfig]
