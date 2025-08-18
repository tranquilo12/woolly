import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { MessageWithModel } from "../chat";
import { forwardRef, useCallback, useMemo, useTransition } from "react";

interface AgentMessageGroupProps {
	group: {
		messages: any[];
		step_index: number;
		completed?: boolean;
	};
	currentStep: number;
	onStepClick?: (stepIndex: number) => void;
	isLoading?: boolean;
}

export const AgentMessageGroup = forwardRef<HTMLDivElement, AgentMessageGroupProps>(
	function AgentMessageGroup({ group, currentStep, onStepClick, isLoading = false }, ref) {
		// ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL RETURNS BEFORE HOOKS
		// React 19 pattern: Use useTransition for non-urgent UI updates
		const [isPending, startTransition] = useTransition();

		// Optimized final message computation with useMemo
		const finalMessage = useMemo(() => {
			if (!group?.messages?.length) return null;

			return group.messages.reduce<any>((latest, current) => {
				// If the current message has a final_result tool invocation, it's the final message
				const hasFinalResult = current.tool_invocations?.some(
					(tool: any) => tool.toolName === 'final_result' && (tool.state === 'result' || tool.state === undefined)
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
		}, [group?.messages]);

		// Memoized loading state check
		const isCurrentlyLoading = useMemo(() =>
			isLoading && group?.step_index === currentStep,
			[isLoading, group?.step_index, currentStep]
		);

		// Optimized message preparation with useMemo
		const messageWithModel = useMemo((): MessageWithModel | null => {
			if (!finalMessage) return null;

			const toolInvocations = finalMessage.tool_invocations || finalMessage.toolInvocations;
			return {
				...finalMessage,
				tool_invocations: toolInvocations,
				role: finalMessage.role as "assistant" | "user" | "system"
			};
		}, [finalMessage]);

		// Optimized step click handler with useCallback
		const handleStepClick = useCallback(() => {
			if (onStepClick && group?.step_index !== undefined) {
				startTransition(() => {
					onStepClick(group.step_index);
				});
			}
		}, [onStepClick, group?.step_index, startTransition]);

		// Optimized badge variant computation with useMemo
		const badgeVariant = useMemo(() => {
			return isCurrentlyLoading ? "default" : "secondary";
		}, [isCurrentlyLoading]);

		// Optimized badge content computation with useMemo
		const badgeContent = useMemo(() => {
			if (isCurrentlyLoading) {
				return (
					<div className="flex items-center gap-1">
						<div className="w-2 h-2 bg-current rounded-full animate-pulse" />
						<span>Processing...</span>
					</div>
				);
			}
			return `Step ${(group?.step_index || 0) + 1}`;
		}, [isCurrentlyLoading, group?.step_index]);

		// Optimized step display computation with useMemo
		const stepDisplay = useMemo(() => {
			const stepNumber = group?.step_index !== undefined ? group.step_index + 1 : 1;
			return `Step ${stepNumber}`;
		}, [group?.step_index]);

		// Status display computation with useMemo
		const statusDisplay = useMemo(() => {
			if (isCurrentlyLoading) return "Processing...";
			return group?.completed ? "Completed" : "In Progress";
		}, [isCurrentlyLoading, group?.completed]);

		// NOW SAFE TO DO CONDITIONAL RETURNS AFTER ALL HOOKS
		if (!group?.messages?.length) {
			return null;
		}

		if (!messageWithModel) {
			return null;
		}

		return (
			<motion.div
				ref={ref}
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
				className="mb-4"
			>
				<Card className="border-l-4 border-l-blue-500">
					<CardContent className="p-4">
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<Badge variant={badgeVariant}>
									{badgeContent}
								</Badge>
								<span className="text-sm text-muted-foreground">
									{statusDisplay}
								</span>
							</div>
							{onStepClick && (
								<Button
									variant="outline"
									size="sm"
									onClick={handleStepClick}
									disabled={isPending}
								>
									{isPending ? "Loading..." : "View Details"}
								</Button>
							)}
						</div>

						<div className="space-y-2">
							{messageWithModel.content && (
								<div className="text-sm">
									{messageWithModel.content}
								</div>
							)}

							{messageWithModel.tool_invocations && messageWithModel.tool_invocations.length > 0 && (
								<div className="text-xs text-muted-foreground">
									Tools used: {messageWithModel.tool_invocations.map((t: any) => t.toolName).join(', ')}
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</motion.div>
		);
	}
); 