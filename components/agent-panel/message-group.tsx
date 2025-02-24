import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { Markdown } from "../markdown";
import { MessageGroup } from "@/types/agent-messages";

interface AgentMessageGroupProps {
	group: MessageGroup;
	currentStep: number;
	onStepClick: (step: number) => void;
}

export function AgentMessageGroup({ group, currentStep, onStepClick }: AgentMessageGroupProps) {
	return (
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
				{group.messages.map((message, index) => (
					<div
						key={message.id}
						className={cn(
							"p-4 rounded",
							message.step_index === currentStep && "bg-accent"
						)}
						onClick={() => onStepClick(message.step_index ?? 0)}
					>
						<div className="flex items-center gap-2 mb-2">
							<span className="text-sm font-medium">
								Step {message.step_index}: {message.step_title}
							</span>
						</div>
						<Markdown>{message.content}</Markdown>
					</div>
				))}
			</div>
		</div>
	);
} 