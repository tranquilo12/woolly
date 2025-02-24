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
					<h3 className="text-sm font-medium">
						Iteration {group.iteration_index + 1}
					</h3>
					<Badge variant={group.completed ? "secondary" : "default"}>
						{group.completed ? "Completed" : "In Progress"}
					</Badge>
				</div>

				<div className="p-4 space-y-4">
					{group.messages.map((message) => {
						// Ensure message has required properties
						const messageWithModel: MessageWithModel = {
							...message,
							// @ts-ignore
							toolInvocations: message.tool_invocations || message.toolInvocations || [],
							// @ts-ignore
							model: message.model || 'gpt-4o-mini',
							data: { dbId: message.id },
							// Parse the content if it's a JSON string
							content: typeof message.content === 'string' && message.content.trim().startsWith('{')
								? JSON.parse(message.content)
								: message.content
						} as MessageWithModel;

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