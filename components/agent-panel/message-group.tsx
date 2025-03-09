import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { MessageGroup } from "@/types/agent-messages";
import { DocumentationMessage } from "../documentation/DocumentationMessage";
import { motion } from "framer-motion";
import { MessageWithModel } from "../chat";
import { Loader2 } from "lucide-react";

interface AgentMessageGroupProps {
	group: MessageGroup;
	currentStep: number;
	onStepClick: (step: number) => void;
	isLoading?: boolean;
}

export function AgentMessageGroup({ group, currentStep, onStepClick, isLoading = false }: AgentMessageGroupProps) {
	if (!group?.messages?.length) {
		return null;
	}

	// Get only the final message for this step
	const finalMessage = group.messages.reduce<any>((latest, current) => {
		// If the current message has a final_result tool invocation, it's the final message
		const hasFinalResult = current.tool_invocations?.some(
			tool => tool.toolName === 'final_result' && (tool.state === 'result' || tool.state === undefined)
		);

		if (hasFinalResult) {
			return current;
		}

		// Otherwise, use the latest message by creation time
		if (!latest || (current.created_at && latest.created_at && new Date(current.created_at) > new Date(latest.created_at))) {
			return current;
		}

		return latest;
	}, null);

	// If there's no final message, don't render anything
	if (!finalMessage) {
		return null;
	}

	// Check if this is the currently loading step
	const isCurrentlyLoading = isLoading && group.step_index === currentStep;

	// Prepare the message with model information
	const toolInvocations = finalMessage.tool_invocations || finalMessage.toolInvocations;
	const messageWithModel: MessageWithModel = {
		...finalMessage,
		tool_invocations: toolInvocations,
		toolInvocations: toolInvocations,
		model: finalMessage.model || 'gpt-4o-mini',
		data: { dbId: finalMessage.id },
		role: finalMessage.role as "assistant" | "user" | "system"
	};

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -20 }}
			className="space-y-4 p-6"
		>
			<div className={cn(
				"mb-6 border rounded-lg overflow-hidden transition-all duration-300",
				isCurrentlyLoading && "border-primary/30 shadow-sm"
			)}>
				<div className={cn(
					"p-4 flex justify-between items-center border-b",
					isCurrentlyLoading ? "bg-primary/5" : "bg-muted"
				)}>
					<div className="flex items-center gap-3">
						<h3 className="text-sm font-medium">
							Step {group.step_index !== undefined ? group.step_index + 1 : 1}
						</h3>
						{group.step_title && (
							<span className="text-sm text-muted-foreground">
								- {group.step_title}
							</span>
						)}
					</div>
					<Badge variant={isCurrentlyLoading ? "outline" : group.completed ? "secondary" : "default"}>
						{isCurrentlyLoading ? (
							<div className="flex items-center gap-1">
								<Loader2 className="h-3 w-3 animate-spin" />
								<span>Processing</span>
							</div>
						) : (
							group.completed ? "Completed" : "In Progress"
						)}
					</Badge>
				</div>

				<div className={cn(
					"p-6 space-y-4",
					isCurrentlyLoading && "bg-primary/5 bg-opacity-5"
				)}>
					{isCurrentlyLoading ? (
						<div className="flex items-center justify-center py-4">
							<div className="flex flex-col items-center gap-2">
								<Loader2 className="h-6 w-6 animate-spin text-primary" />
								<p className="text-sm text-muted-foreground">Generating content...</p>
							</div>
						</div>
					) : (
						<DocumentationMessage
							message={messageWithModel}
							className={cn(
								"p-4 rounded-lg",
								messageWithModel.role === "assistant" ? "bg-muted" : "bg-background"
							)}
						/>
					)}
				</div>
			</div>
		</motion.div>
	);
} 