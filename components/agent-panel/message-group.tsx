import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { MessageGroup } from "@/types/agent-messages";
import { DocumentationMessage } from "../documentation/DocumentationMessage";
import { motion } from "framer-motion";
import { MessageWithModel } from "../chat";

interface AgentMessageGroupProps {
	group: MessageGroup;
	currentStep: number;
	onStepClick: (step: number) => void;
}

export function AgentMessageGroup({ group, currentStep, onStepClick }: AgentMessageGroupProps) {
	if (!group?.messages?.length) {
		return null;
	}

	console.log("[DEBUG] Rendering message group:", {
		iterationIndex: group.iteration_index,
		messageCount: group.messages.length,
		completed: group.completed
	});

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -20 }}
			className="space-y-4"
		>
			<div className="mb-6 border rounded-lg overflow-hidden">
				<div className="bg-muted p-2 flex justify-between items-center">
					<div className="flex items-center gap-2">
						<h3 className="text-sm font-medium">
							Step {group.step_index !== undefined ? group.step_index + 1 : 1}
						</h3>
						{group.step_title && (
							<span className="text-sm text-muted-foreground">
								- {group.step_title}
							</span>
						)}
					</div>
					<Badge variant={group.completed ? "secondary" : "default"}>
						{group.completed ? "Completed" : "In Progress"}
					</Badge>
				</div>

				<div className="p-4 space-y-4">
					{group.messages.map((message) => {
						// Skip empty or invalid messages
						if (!message.content && !message.tool_invocations?.length) {
							return null;
						}

						const messageWithModel: MessageWithModel = {
							...message,
							toolInvocations: message.tool_invocations || message.toolInvocations,
							model: message.model || 'gpt-4o-mini',
							data: { dbId: message.id },
							role: message.role as "assistant" | "user" | "system"
						};

						return (
							<DocumentationMessage
								key={message.id}
								message={messageWithModel}
								className={cn(
									"p-4 rounded-lg",
									message.role === "assistant" ? "bg-muted" : "bg-background"
								)}
							/>
						);
					})}
				</div>
			</div>
		</motion.div>
	);
} 