import { z } from "zod";

// Base schemas for validation
const systemOverviewSchema = z.object({
	architecture_diagram: z.string(),
	core_technologies: z.array(z.string()),
	design_patterns: z.array(z.string()),
	system_requirements: z.array(z.string()).optional(),
	project_structure: z.string()
});

const apiOverviewSchema = z.object({
	title: z.string(),
	version: z.string(),
	description: z.string(),
	authentication_methods: z.array(z.string()),
	architecture_diagram: z.string(),
	core_technologies: z.array(z.string()),
	rate_limits: z.record(z.string()).optional()
});

const componentAnalysisSchema = z.object({
	component_name: z.string(),
	description: z.string(),
	dependencies: z.array(z.string())
});

const developmentGuideSchema = z.object({
	setup_instructions: z.string(),
	workflow_documentation: z.string()
});

const maintenanceOpsSchema = z.object({
	maintenance_procedures: z.array(z.string()),
	troubleshooting_guide: z.record(z.string(), z.string())
});

const codeDocumentationSchema = z.object({
	code_module: z.array(z.object({
		name: z.string(),
		purpose: z.string(),
		dependencies: z.array(z.string()),
		usage_examples: z.array(z.string())
	})),
});

// Type definitions
export interface SystemOverview extends z.infer<typeof systemOverviewSchema> { }
export interface APIOverview extends z.infer<typeof apiOverviewSchema> { }
export interface ComponentAnalysis extends z.infer<typeof componentAnalysisSchema> { }
export interface DevelopmentGuide extends z.infer<typeof developmentGuideSchema> { }
export interface MaintenanceOps extends z.infer<typeof maintenanceOpsSchema> { }

// Type guards with validation
export function isSystemOverview(content: unknown): content is SystemOverview {
	try {
		systemOverviewSchema.parse(content);
		return true;
	} catch {
		return false;
	}
}

export function isAPIOverview(content: unknown): content is APIOverview {
	try {
		apiOverviewSchema.parse(content);
		return true;
	} catch {
		return false;
	}
}

export function isComponentAnalysis(content: unknown): content is ComponentAnalysis {
	try {
		componentAnalysisSchema.parse(content);
		return true;
	} catch {
		return false;
	}
}

export function isDevelopmentGuide(content: unknown): content is DevelopmentGuide {
	try {
		developmentGuideSchema.parse(content);
		return true;
	} catch {
		return false;
	}
}

export function isMaintenanceOps(content: unknown): content is MaintenanceOps {
	try {
		maintenanceOpsSchema.parse(content);
		return true;
	} catch {
		return false;
	}
}

export function isCodeDocumentation(content: unknown): content is CodeDocumentation {
	try {
		codeDocumentationSchema.parse(content);
		return true;
	} catch {
		return false;
	}
}

// Type for the step results
export type StepResult =
	| { step: 0; result: SystemOverview }
	| { step: 1; result: ComponentAnalysis }
	| { step: 2; result: APIOverview }
	| { step: 3; result: DevelopmentGuide }
	| { step: 4; result: MaintenanceOps };

// Helper function to determine the type of content
export function getDocumentationType(content: unknown): string | null {
	if (isSystemOverview(content)) return 'system-overview';
	if (isAPIOverview(content)) return 'api-overview';
	if (isComponentAnalysis(content)) return 'component-analysis';
	if (isDevelopmentGuide(content)) return 'development-guide';
	if (isMaintenanceOps(content)) return 'maintenance-ops';
	return null;
}

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