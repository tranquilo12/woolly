import { Message } from "@ai-sdk/ui-utils";

export interface AgentMessage extends Message {
	id: string;
	role: "assistant" | "user" | "system";
	content: string;
	created_at: string;
	tool_invocations?: any[];
	model?: string;
	iteration_index?: number;
	step_index?: number;
	step_title?: string;
}

export interface MessageGroup {
	iteration_index: number;
	messages: AgentMessage[];
	completed: boolean;
	step_index?: number;
	step_title?: string;
} 