// Base types for documentation sections
export interface SystemOverview {
	architecture_diagram: string;
	core_technologies: string[];
	design_patterns: string[];
	system_requirements: string[];
	project_structure: string;
}

export interface ComponentAnalysis {
	name: string;
	purpose: string;
	dependencies: string[];
	relationships_diagram: string;
	technical_details: Record<string, any>;
	integration_points: string[];
}

export interface CodeDocumentation {
	modules: Array<Record<string, any>>;
	patterns: string[];
	usage_examples: string[];
	api_specs?: Record<string, any>;
}

export interface DevelopmentGuide {
	setup: string;
	workflow: string;
	guidelines: string[];
}

export interface MaintenanceOps {
	procedures: string[];
	troubleshooting: Record<string, string>;
	operations: string;
}

// Combined documentation result type
export interface DocumentationResult {
	systemOverview?: SystemOverview;
	componentAnalysis?: ComponentAnalysis[];
	codeDocumentation?: CodeDocumentation[];
	developmentGuide?: DevelopmentGuide;
	maintenanceOps?: MaintenanceOps;
}

// Type for the step results
export type StepResult =
	| { step: 0; result: SystemOverview }
	| { step: 1; result: ComponentAnalysis }
	| { step: 2; result: CodeDocumentation }
	| { step: 3; result: DevelopmentGuide }
	| { step: 4; result: MaintenanceOps };

// Add type guards to existing types file
export function isSystemOverview(obj: any): obj is SystemOverview {
	return obj &&
		typeof obj.architecture_diagram === 'string' &&
		Array.isArray(obj.core_technologies) &&
		Array.isArray(obj.design_patterns) &&
		Array.isArray(obj.system_requirements) &&
		typeof obj.project_structure === 'string';
}

export function isComponentAnalysis(obj: any): obj is ComponentAnalysis {
	return obj &&
		typeof obj.name === 'string' &&
		typeof obj.purpose === 'string' &&
		Array.isArray(obj.dependencies) &&
		typeof obj.relationships_diagram === 'string' &&
		typeof obj.technical_details === 'object' &&
		Array.isArray(obj.integration_points);
}

export function isCodeDocumentation(obj: any): obj is CodeDocumentation {
	return obj &&
		Array.isArray(obj.modules) &&
		Array.isArray(obj.patterns) &&
		Array.isArray(obj.usage_examples);
}

export function isDevelopmentGuide(obj: any): obj is DevelopmentGuide {
	return obj &&
		typeof obj.setup === 'string' &&
		typeof obj.workflow === 'string' &&
		Array.isArray(obj.guidelines);
}

export function isMaintenanceOps(obj: any): obj is MaintenanceOps {
	return obj &&
		Array.isArray(obj.procedures) &&
		typeof obj.troubleshooting === 'object' &&
		typeof obj.operations === 'string';
} 