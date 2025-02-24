// Base types for documentation sections
export interface SystemOverview {
	architecture_diagram: string;
	core_technologies: string[];
	design_patterns: string[];
	system_requirements: string[];
	project_structure: string;
}

export interface ComponentAnalysis {
	component_name: string;
	description: string;
	dependencies: string[];
}

export interface CodeDocumentation {
	code_module: string;
	description: string;
	usage_examples: string[];
}

export interface DevelopmentGuide {
	setup_instructions: string;
	workflow_documentation: string;
}

export interface MaintenanceOps {
	maintenance_procedures: string;
	troubleshooting_guide: string;
}

// API-focused Documentation Types
export interface APIOverview {
	title: string;
	version: string;
	description: string;
	base_url: string;
	authentication_methods: string[];
	architecture_diagram: string;
	core_technologies: string[];
	global_headers?: Record<string, string>;
	rate_limits?: Record<string, string>;
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
		typeof obj.component_name === 'string' &&
		typeof obj.description === 'string' &&
		Array.isArray(obj.dependencies);
}

export function isCodeDocumentation(obj: any): obj is CodeDocumentation {
	return obj &&
		typeof obj.code_module === 'string' &&
		typeof obj.description === 'string' &&
		Array.isArray(obj.usage_examples);
}

export function isDevelopmentGuide(obj: any): obj is DevelopmentGuide {
	return obj &&
		typeof obj.setup_instructions === 'string' &&
		typeof obj.workflow_documentation === 'string';
}

export function isMaintenanceOps(obj: any): obj is MaintenanceOps {
	return obj &&
		typeof obj.maintenance_procedures === 'string' &&
		typeof obj.troubleshooting_guide === 'string';
}

// Type Guards
export const isAPIOverview = (content: any): content is APIOverview => {
	return content &&
		'authentication_methods' in content &&
		'architecture_diagram' in content &&
		'core_technologies' in content;
}; 