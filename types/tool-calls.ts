import { CoreToolCall } from "ai";

export interface ExtendedToolCall extends CoreToolCall<string, unknown> {
	state: "call" | "partial-call";
	toolCallId: string;
	toolName: string;
	args: any;
	result?: {
		success?: boolean;
		error?: {
			type?: string;
			message?: string;
		};
		output?: string;
		plots?: Record<string, string>;
		metrics?: {
			memory_usage?: number;
			cpu_percent?: number;
			execution_time?: number;
		};
	};
}

export interface StreamingToolCallEvent {
	type: "tool_call";
	data: {
		id: string;
		function: {
			name: string;
			arguments: any;
		};
		state: "call" | "partial-call" | "result";
		result?: any;
	};
}