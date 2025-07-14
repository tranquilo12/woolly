// Bridge to MCP server instead of direct indexer access
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
export const MCP_SERVER_URL = process.env.NEXT_PUBLIC_MCP_URL || 'http://localhost:8009';

// Repository type - will be populated dynamically from MCP server
export type Repository = {
	name: string;
	needs_indexing: boolean;
	indexing_status?: string;
	changed_files?: string[];
	last_indexed?: number;
	indexed_files?: number;
	total_files?: number;
	watch_enabled?: boolean;
	processed_count?: number;
	progress?: number;
	message?: string;
	current_file?: string;
};

export type AvailableRepository = string; // Repository names will be fetched from MCP server 