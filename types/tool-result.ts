interface Metrics {
	memory_usage: number;
	cpu_percent: number;
	execution_time: number;
}

interface ToolResult {
	success: boolean;
	output: string;
	error: string | null;
	metrics: Metrics;
	plots?: Record<string, string>;
}

export type { ToolResult, Metrics }; 