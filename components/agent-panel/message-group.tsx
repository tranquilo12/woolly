import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { MessageGroup } from "@/types/agent-messages";
import { DocumentationMessage } from "../documentation/DocumentationMessage";
import { motion } from "framer-motion";
import { MessageWithModel } from "../chat";
import { Loader2 } from "lucide-react";
import { forwardRef, useCallback, useMemo, useTransition } from "react";

interface AgentMessageGroupProps {
	group: MessageGroup;
	currentStep: number;
	onStepClick: (step: number) => void;
	isLoading?: boolean;
}

export const AgentMessageGroup = forwardRef<HTMLDivElement, AgentMessageGroupProps>(
	function AgentMessageGroup({ group, currentStep, onStepClick, isLoading = false }, ref) {
		// Early return for invalid group data
		if (!group?.messages?.length) {
			return null;
		}

		// React 19 pattern: Use useTransition for non-urgent UI updates
		const [isPending, startTransition] = useTransition();

		// Optimized final message computation with useMemo
		const finalMessage = useMemo(() => {
			return group.messages.reduce<any>((latest, current) => {
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
		}, [group.messages]);

		// Memoized loading state check
		const isCurrentlyLoading = useMemo(() =>
			isLoading && group.step_index === currentStep,
			[isLoading, group.step_index, currentStep]
		);

		// Optimized message preparation with useMemo
		const messageWithModel = useMemo((): MessageWithModel | null => {
			if (!finalMessage) return null;

			const toolInvocations = finalMessage.tool_invocations || finalMessage.toolInvocations;
			return {
				...finalMessage,
				tool_invocations: toolInvocations,
				toolInvocations: toolInvocations,
				model: finalMessage.model || 'gpt-4o-mini',
				data: { dbId: finalMessage.id },
				role: finalMessage.role as "assistant" | "user" | "system"
			};
		}, [finalMessage]);

		// Optimized step click handler with useCallback
		const handleStepClick = useCallback(() => {
			if (group.step_index !== undefined) {
				// Use startTransition for non-urgent navigation updates
				startTransition(() => {
					onStepClick(group.step_index!);
				});
			}
		}, [group.step_index, onStepClick, startTransition]);

		// Memoized badge variant calculation
		const badgeVariant = useMemo(() => {
			if (isCurrentlyLoading) return "outline";
			return group.completed ? "secondary" : "default";
		}, [isCurrentlyLoading, group.completed]);

		// Memoized badge content
		const badgeContent = useMemo(() => {
			if (isCurrentlyLoading) {
				return (
					<div className="flex items-center gap-1">
						<Loader2 className="h-3 w-3 animate-spin" />
						<span>Processing</span>
					</div>
				);
			}
			return group.completed ? "Completed" : "In Progress";
		}, [isCurrentlyLoading, group.completed]);

		// Memoized step display
		const stepDisplay = useMemo(() => {
			const stepNumber = group.step_index !== undefined ? group.step_index + 1 : 1;
			return `Step ${stepNumber}`;
		}, [group.step_index]);

		// Early return if no final message after processing
		if (!messageWithModel) {
			return null;
		}

		return (
			<motion.div
				ref={ref}
				layout
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -20 }}
				className="space-y-4 p-6"
				id={`message-group-${group.step_index}`}
				role="article"
				aria-label={`${stepDisplay} - ${group.step_title || 'Agent response'}`}
			>
				<div className={cn(
					"mb-6 border rounded-lg overflow-hidden transition-all duration-300",
					isCurrentlyLoading && "border-primary/30 shadow-sm",
					isPending && "opacity-75" // Visual feedback during transitions
				)}>
					<div
						className={cn(
							"p-4 flex justify-between items-center border-b cursor-pointer",
							"hover:bg-muted/50 transition-colors",
							isCurrentlyLoading ? "bg-primary/5" : "bg-muted"
						)}
						onClick={handleStepClick}
						role="button"
						tabIndex={0}
						aria-label={`Navigate to ${stepDisplay}`}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handleStepClick();
							}
						}}
					>
						<div className="flex items-center gap-3">
							<h3 className="text-sm font-medium">
								{stepDisplay}
							</h3>
							{group.step_title && (
								<span className="text-sm text-muted-foreground">
									- {group.step_title}
								</span>
							)}
						</div>
						<Badge variant={badgeVariant}>
							{badgeContent}
						</Badge>
					</div>

					<div className={cn(
						"p-6 space-y-4",
						isCurrentlyLoading && "bg-primary/5 bg-opacity-5"
					)}>
						{isCurrentlyLoading ? (
							<div
								className="flex items-center justify-center py-4"
								role="status"
								aria-live="polite"
								aria-label="Generating content"
							>
								<div className="flex flex-col items-center gap-2">
									<Loader2 className="h-6 w-6 animate-spin text-primary" />
									<p className="text-sm text-muted-foreground">Generating content...</p>
								</div>
							</div>
						) : (
							<DocumentationMessage
								message={messageWithModel}
								className={cn(
									"p-4 rounded-lg transition-colors",
									messageWithModel.role === "assistant" ? "bg-muted" : "bg-background"
								)}
							/>
						)}
					</div>
				</div>
			</motion.div>
		);
	}
); 