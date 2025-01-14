export interface DocumentationRequest {
	repo_name: string;
	file_paths?: string[];
	agent_id: string;
}

export interface DocumentationState {
	isGenerating: boolean;
	selectedRepo: string | null;
	selectedFiles: string[];
	error: string | null;
	toolInvocations: any[];
} 