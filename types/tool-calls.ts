import { CoreToolCall } from "ai";

export interface ExtendedToolCall extends CoreToolCall<string, unknown> {
	state: "call" | "partial-call" | "result";
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