"""
Examples of Extending the Base Agent Factory

This module demonstrates how the generalized BaseAgentFactory can be extended
to create different types of agents while maintaining consistency and reusability.

Examples include:
- Support Agent (customer service, issue resolution)
- Security Agent (vulnerability analysis, compliance checking)
- Performance Agent (optimization, monitoring)
- Testing Agent (test generation, coverage analysis)
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from .core import (
    BaseAgentFactory,
    BaseAgentDependencies,
    BaseAgentResult,
    MCPToolMixin,
    AgentSpecialization,
    register_agent_factory,
)


# Support Agent Implementation
class SupportDependencies(BaseAgentDependencies):
    """Dependencies for support agents"""

    issue_type: str
    priority: str = "medium"
    user_context: Dict[str, Any] = Field(default_factory=dict)


class SupportResult(BaseAgentResult):
    """Results from support agents"""

    solution_steps: List[str] = Field(default_factory=list)
    escalation_needed: bool = False
    related_docs: List[str] = Field(default_factory=list)


class SupportAgentFactory(
    BaseAgentFactory[SupportDependencies, SupportResult], MCPToolMixin
):
    """Factory for creating customer support agents"""

    def __init__(self):
        base_prompt = """You are an expert customer support agent with access to comprehensive codebase knowledge.
        
Your goal is to help users resolve issues, understand features, and navigate the system effectively.
Use your MCP tools to find relevant code, documentation, and examples to provide accurate solutions.

Always provide:
1. Clear, step-by-step solutions
2. Code examples when relevant
3. Links to relevant documentation
4. Escalation recommendations for complex issues"""

        super().__init__(
            agent_type="support",
            base_system_prompt=base_prompt,
            dependencies_type=SupportDependencies,
            result_type=SupportResult,
        )

    def _register_base_tools(self) -> None:
        """Register support-specific tools"""
        self.register_mcp_tools()

        # Add support-specific tools
        async def search_known_issues(ctx, query: str) -> Dict[str, Any]:
            """Search for known issues and solutions"""
            return {
                "query": query,
                "known_issues": [],
                "solutions": [],
                "status": "success",
            }

        self.register_tool("search_known_issues", search_known_issues)

    def _define_specializations(self) -> None:
        """Define support specializations"""
        specializations = [
            AgentSpecialization(
                name="technical_support",
                description="Technical issue resolution and troubleshooting",
                system_prompt="""
SPECIALIZATION: Technical Support Expert

Focus on resolving technical issues and providing implementation guidance.

Your Process:
1. Use search_codebase to find relevant code examples
2. Use qa_codebase to understand system behavior
3. Use search_known_issues to check for similar problems
4. Provide step-by-step technical solutions

Generate responses including:
- Root cause analysis
- Step-by-step resolution steps
- Code examples and configurations
- Prevention recommendations
""",
                tools=["search_codebase", "qa_codebase", "search_known_issues"],
            ),
            AgentSpecialization(
                name="user_onboarding",
                description="Help new users get started with the system",
                system_prompt="""
SPECIALIZATION: User Onboarding Expert

Focus on helping new users understand and start using the system.

Your Process:
1. Use find_entities to identify key components
2. Use qa_codebase to understand user workflows
3. Use search_codebase to find setup examples
4. Create personalized onboarding paths

Generate responses including:
- Getting started guides
- Common workflows
- Best practices
- Resource recommendations
""",
                tools=["find_entities", "qa_codebase", "search_codebase"],
            ),
        ]

        for spec in specializations:
            self.register_specialization(spec)


# Security Agent Implementation
class SecurityDependencies(BaseAgentDependencies):
    """Dependencies for security agents"""

    security_focus: str  # "vulnerability", "compliance", "audit"
    severity_threshold: str = "medium"


class SecurityResult(BaseAgentResult):
    """Results from security analysis"""

    vulnerabilities: List[Dict[str, Any]] = Field(default_factory=list)
    risk_level: str = "unknown"
    recommendations: List[str] = Field(default_factory=list)
    compliance_status: Dict[str, Any] = Field(default_factory=dict)


class SecurityAgentFactory(
    BaseAgentFactory[SecurityDependencies, SecurityResult], MCPToolMixin
):
    """Factory for creating security analysis agents"""

    def __init__(self):
        base_prompt = """You are a cybersecurity expert with deep knowledge of secure coding practices and vulnerability assessment.

Your mission is to identify security risks, ensure compliance, and recommend security improvements.
Use your MCP tools to analyze code for security patterns, vulnerabilities, and compliance issues.

Focus areas:
1. Code vulnerability analysis
2. Security best practices validation
3. Compliance checking
4. Risk assessment and mitigation"""

        super().__init__(
            agent_type="security",
            base_system_prompt=base_prompt,
            dependencies_type=SecurityDependencies,
            result_type=SecurityResult,
        )

    def _register_base_tools(self) -> None:
        """Register security-specific tools"""
        self.register_mcp_tools()

        # Add security-specific tools
        async def scan_vulnerabilities(ctx, file_patterns: List[str]) -> Dict[str, Any]:
            """Scan for security vulnerabilities"""
            return {
                "scanned_files": file_patterns,
                "vulnerabilities": [],
                "risk_score": 0,
                "status": "success",
            }

        async def check_compliance(ctx, standard: str) -> Dict[str, Any]:
            """Check compliance with security standards"""
            return {
                "standard": standard,
                "compliance_score": 0,
                "violations": [],
                "status": "success",
            }

        self.register_tool("scan_vulnerabilities", scan_vulnerabilities)
        self.register_tool("check_compliance", check_compliance)

    def _define_specializations(self) -> None:
        """Define security specializations"""
        specializations = [
            AgentSpecialization(
                name="vulnerability_assessment",
                description="Identify and assess security vulnerabilities",
                system_prompt="""
SPECIALIZATION: Vulnerability Assessment Expert

Focus on identifying security vulnerabilities and assessing their impact.

Your Process:
1. Use search_codebase to find security-sensitive code
2. Use scan_vulnerabilities to identify potential issues
3. Use get_entity_relationships to understand attack vectors
4. Assess risk levels and provide remediation steps

Generate comprehensive reports including:
- Vulnerability inventory with severity ratings
- Potential attack vectors and impact analysis
- Detailed remediation recommendations
- Security best practices for prevention
""",
                tools=[
                    "search_codebase",
                    "scan_vulnerabilities",
                    "get_entity_relationships",
                ],
            )
        ]

        for spec in specializations:
            self.register_specialization(spec)


# Performance Agent Implementation
class PerformanceDependencies(BaseAgentDependencies):
    """Dependencies for performance agents"""

    performance_focus: str  # "optimization", "monitoring", "benchmarking"
    target_metrics: List[str] = Field(default_factory=list)


class PerformanceResult(BaseAgentResult):
    """Results from performance analysis"""

    bottlenecks: List[Dict[str, Any]] = Field(default_factory=list)
    optimizations: List[str] = Field(default_factory=list)
    metrics: Dict[str, Any] = Field(default_factory=dict)
    recommendations: List[str] = Field(default_factory=list)


class PerformanceAgentFactory(
    BaseAgentFactory[PerformanceDependencies, PerformanceResult], MCPToolMixin
):
    """Factory for creating performance analysis agents"""

    def __init__(self):
        base_prompt = """You are a performance optimization expert with deep understanding of system performance and scalability.

Your mission is to identify performance bottlenecks, optimize system performance, and establish monitoring strategies.
Use your MCP tools to analyze code patterns, identify inefficiencies, and recommend optimizations.

Focus areas:
1. Performance bottleneck identification
2. Code optimization recommendations
3. Scalability analysis
4. Monitoring and alerting strategies"""

        super().__init__(
            agent_type="performance",
            base_system_prompt=base_prompt,
            dependencies_type=PerformanceDependencies,
            result_type=PerformanceResult,
        )

    def _register_base_tools(self) -> None:
        """Register performance-specific tools"""
        self.register_mcp_tools()

        # Add performance-specific tools
        async def analyze_performance_patterns(
            ctx, code_patterns: List[str]
        ) -> Dict[str, Any]:
            """Analyze code for performance patterns"""
            return {
                "patterns_analyzed": code_patterns,
                "performance_issues": [],
                "optimization_opportunities": [],
                "status": "success",
            }

        self.register_tool("analyze_performance_patterns", analyze_performance_patterns)

    def _define_specializations(self) -> None:
        """Define performance specializations"""
        specializations = [
            AgentSpecialization(
                name="bottleneck_analysis",
                description="Identify and analyze performance bottlenecks",
                system_prompt="""
SPECIALIZATION: Performance Bottleneck Expert

Focus on identifying performance bottlenecks and optimization opportunities.

Your Process:
1. Use search_codebase to find performance-critical code
2. Use analyze_performance_patterns to identify inefficiencies
3. Use get_entity_relationships to understand data flow
4. Provide specific optimization recommendations

Generate detailed analysis including:
- Bottleneck identification with impact assessment
- Root cause analysis of performance issues
- Specific optimization recommendations with code examples
- Performance monitoring strategies
""",
                tools=[
                    "search_codebase",
                    "analyze_performance_patterns",
                    "get_entity_relationships",
                ],
            )
        ]

        for spec in specializations:
            self.register_specialization(spec)


# Register all example factories
def register_example_factories():
    """Register all example agent factories"""
    register_agent_factory("support", SupportAgentFactory())
    register_agent_factory("security", SecurityAgentFactory())
    register_agent_factory("performance", PerformanceAgentFactory())


# Auto-register when module is imported
register_example_factories()
