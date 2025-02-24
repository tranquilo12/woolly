import { Message } from "@ai-sdk/ui-utils";

export interface AgentMessage extends Message {
	iteration_index?: number;
	step_index?: number;
	step_title?: string;
}

export interface MessageGroup {
	iteration_index: number;
	messages: AgentMessage[];
	completed: boolean;
} 