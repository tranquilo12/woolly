
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
	code_module: {
		name: string;
		purpose: string;
		dependencies: string[];
		usage_examples: string[];
	}[];
}

export interface DevelopmentGuide {
	setup_instructions: string;
	workflow_documentation: string;
	guidelines: string[];
}

export interface MaintenanceOps {
	maintenance_procedures: string[];
	troubleshooting_guide: Record<string, string>;
	operations: string;
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
		'architecture_diagram' in obj &&
		'core_technologies' in obj &&
		'design_patterns' in obj &&
		'system_requirements' in obj &&
		'project_structure' in obj;
}

export function isComponentAnalysis(obj: any): obj is ComponentAnalysis {
	return obj &&
		'component_name' in obj &&
		'description' in obj &&
		'dependencies' in obj;
}

export function isCodeDocumentation(obj: any): obj is CodeDocumentation {
	return obj &&
		'code_module' in obj &&
		'description' in obj &&
		'usage_examples' in obj;
}

export function isDevelopmentGuide(obj: any): obj is DevelopmentGuide {
	return obj &&
		'setup_instructions' in obj &&
		'workflow_documentation' in obj;
}

export function isMaintenanceOps(obj: any): obj is MaintenanceOps {
	return obj &&
		'maintenance_procedures' in obj &&
		'troubleshooting_guide' in obj;
}

// Type Guards
export const isAPIOverview = (content: any): content is APIOverview => {
	return content &&
		'title' in content &&
		'version' in content &&
		'authentication_methods' in content;
}; 