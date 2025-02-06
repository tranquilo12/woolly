'use client';

import { useChat } from 'ai/react';
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Bot, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvailableRepository } from "@/lib/constants";
import { Message } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { Markdown } from "../markdown";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { useState, useEffect, useCallback } from 'react';
import { ToolInvocationDisplay } from "../tool-invocation";

interface DocumentationViewProps {
	repo_name: AvailableRepository;
	agent_id: string;
	file_paths: string[];
	chat_id: string;
}

interface DocumentationState {
	currentStep: number;
	completedSteps: number[];
	context: {
		systemOverview?: string;
		componentAnalysis?: string;
		codeDocumentation?: string;
		developmentGuides?: string;
		maintenanceOps?: string;
	};
}

interface StepConfig {
	id: number;
	title: string;
	prompt: string;
	description: string;
	requiresConfirmation: boolean;
}

const DOCUMENTATION_STEPS: StepConfig[] = [
	{
		id: 1,
		title: "System Overview",
		prompt: "Generate a comprehensive system overview including architecture diagrams, core technologies, and key design patterns.",
		description: "Analyzing system architecture and core components...",
		requiresConfirmation: true
	},
	{
		id: 2,
		title: "Component Analysis",
		prompt: "Analyze each major component's structure, dependencies, and technical details.",
		description: "Examining component relationships and dependencies...",
		requiresConfirmation: true
	},
	{
		id: 3,
		title: "Code Documentation",
		prompt: "Document significant code modules, their purposes, and usage patterns.",
		description: "Documenting code modules and patterns...",
		requiresConfirmation: true
	},
	{
		id: 4,
		title: "Development Guides",
		prompt: "Create development setup instructions and workflow documentation.",
		description: "Generating development guides and workflows...",
		requiresConfirmation: true
	},
	{
		id: 5,
		title: "Maintenance & Operations",
		prompt: "Document maintenance procedures, troubleshooting guides, and operational considerations.",
		description: "Documenting maintenance and operations...",
		requiresConfirmation: true
	}
];

export function DocumentationView({ repo_name, agent_id, file_paths, chat_id }: DocumentationViewProps) {
	const [containerRef, endRef, scrollToBottom] = useScrollToBottom<HTMLDivElement>();
	const { data: initialMessages, isError, isLoading: isLoadingInitial, saveMessage } = useAgentMessages(
		chat_id,
		agent_id,
		repo_name,
		'documentation'
	);

	const [state, setState] = useState<DocumentationState>({
		currentStep: 0,
		completedSteps: [],
		context: {}
	});

	const [currentStepContent, setCurrentStepContent] = useState<string>('');
	const [isStepComplete, setIsStepComplete] = useState<boolean>(false);

	// NEW: Define handleStepComplete early using useCallback so it's available for useChat.onFinish
	const handleStepComplete = useCallback((context: any) => {
		console.log('Step Complete triggered with context:', context);
		console.log('Current step:', state.currentStep);
		console.log('Current step content:', currentStepContent);

		const currentStepKey = DOCUMENTATION_STEPS[state.currentStep].title.toLowerCase().replace(/\s+/g, '_');
		console.log('Generated step key:', currentStepKey);

		setState(prev => {
			const newState = {
				...prev,
				context: {
					...prev.context,
					[currentStepKey]: currentStepContent
				},
				completedSteps: [...prev.completedSteps, prev.currentStep],
				currentStep: Math.min(prev.currentStep + 1, DOCUMENTATION_STEPS.length)
			};
			console.log('Updated state:', newState);
			return newState;
		});

		setIsStepComplete(true);
		setCurrentStepContent('');
	}, [state.currentStep, currentStepContent]);

	const {
		messages: streamingMessages,
		append,
		isLoading,
		error,
		reload,
		stop,
		setMessages: setStreamingMessages
	} = useChat({
		api: `/api/agents/${agent_id}/documentation`,
		id: chat_id,
		initialMessages,
		body: {
			id: chat_id,
			messages: initialMessages || [],
			model: "gpt-4o-mini",
			agent_id: agent_id,
			repo_name: repo_name,
			file_paths: file_paths,
			chat_id: chat_id,
			step: state.currentStep + 1,
			context: state.context || {}
		},
		onToolCall: async ({ toolCall }) => {
			console.log(toolCall);
			// Handle streaming tool calls
			try {
				// Update messages with tool invocations
				setStreamingMessages(prevMessages => {
					const lastMessage = prevMessages[prevMessages.length - 1];
					if (!lastMessage) return prevMessages;

					const updatedToolInvocations = lastMessage.toolInvocations || [];
					const existingToolIndex = updatedToolInvocations.findIndex(
						t => t.toolCallId === toolCall.toolCallId
					);

					const formattedToolCall = {
						toolCallId: toolCall.toolCallId,
						toolName: toolCall.toolName,
						args: toolCall.args,
						// @ts-ignore Property 'state' does not exist on type 'ToolCall<string, unknown>'
						state: toolCall.state || 'partial-call',
						// @ts-ignore Property 'result' does not exist on type 'ToolCall<string, unknown>'
						result: toolCall.result
					};

					if (existingToolIndex >= 0) {
						updatedToolInvocations[existingToolIndex] = {
							...updatedToolInvocations[existingToolIndex],
							...formattedToolCall
						};
					} else {
						updatedToolInvocations.push(formattedToolCall);
					}

					return prevMessages.map((msg, i) =>
						i === prevMessages.length - 1
							? { ...msg, toolInvocations: updatedToolInvocations }
							: msg
					);
				});

				// Handle streaming JSON content
				const delta = (toolCall.args as { delta?: string })?.delta;
				if (delta) {
					setCurrentStepContent(prev => {
						try {
							// If prev is empty, start with empty JSON
							const prevContent = prev ? prev : '{}';

							// If delta starts with {, it's a new JSON object
							if (delta.startsWith('{')) {
								return delta;
							}

							// Otherwise append to existing content
							return prevContent.slice(0, -1) + delta;
						} catch (error) {
							console.error("Error updating content:", error);
							return prev;
						}
					});
				}

				return toolCall.args;
			} catch (error) {
				console.error("Error handling tool call:", error);
				return toolCall.args;
			}
		},
		onFinish: (message) => {
			try {
				console.log("Finished message:", message);
				// Save message with tool invocations
				saveMessage({
					agentId: agent_id,
					chatId: chat_id,
					repository: repo_name,
					messageType: 'documentation',
					role: message.role,
					content: message.content || '',
					toolInvocations: message.toolInvocations?.map(tool => ({
						toolCallId: tool.toolCallId,
						toolName: tool.toolName,
						args: tool.args,
						state: tool.state,
						result: 'result' in tool ? tool.result : undefined
					})) || []
				});

				// Check for completion in either message content or tool invocations
				const hasCompletedToolInvocation = message.toolInvocations?.some(
					tool => tool.toolName === 'final_result'
				);

				if (message.content) {
					try {
						const parsedContent = JSON.parse(message.content);
						if (parsedContent.finishReason === "step_complete") {
							// Use the updated handleStepComplete provided by useCallback
							handleStepComplete(parsedContent.context || {});
						}
					} catch (e) {
						console.error("Error parsing message content:", e);
						// If parsing fails, check if we have a completed tool invocation
						if (hasCompletedToolInvocation) {
							handleStepComplete({});
						}
					}
				} else if (hasCompletedToolInvocation) {
					// If no content but we have a completed final_result tool invocation
					handleStepComplete({});
				}
			} catch (e) {
				console.error("Error in onFinish:", e);
			}
		},
	});

	const handleGenerateDoc = useCallback(async () => {
		if (isLoading || state.currentStep >= DOCUMENTATION_STEPS.length) {
			return;
		}

		const currentStep = DOCUMENTATION_STEPS[state.currentStep];
		setCurrentStepContent('');
		setIsStepComplete(false);

		try {
			await append({
				role: 'user',
				content: currentStep.prompt
			}, {
				body: {
					id: chat_id,
					messages: initialMessages || [],
					model: "gpt-4o-mini",
					agent_id: agent_id,
					repo_name: repo_name,
					file_paths: file_paths,
					chat_id: chat_id,
					step: state.currentStep + 1,
					context: state.context || {}
				}
			});

		} catch (error) {
			console.error("Failed to generate documentation:", error);
		}
	}, [append, state.currentStep, state.context, isLoading, chat_id, agent_id, repo_name, file_paths, initialMessages]);

	useEffect(() => {
		if (isStepComplete && state.currentStep < DOCUMENTATION_STEPS.length) {
			// Small delay to ensure state updates are complete
			const timer = setTimeout(() => {
				setIsStepComplete(false); // Reset completion flag
				handleGenerateDoc(); // Start next step
			}, 100);

			return () => clearTimeout(timer);
		}
	}, [isStepComplete, state.currentStep, handleGenerateDoc]);

	if (isLoadingInitial) {
		return <div className="flex items-center justify-center h-full">
			<Loader2 className="h-8 w-8 animate-spin" />
		</div>;
	}

	if (isError) {
		return <div className="flex items-center justify-center h-full text-destructive">
			Failed to load messages. Please try again.
		</div>;
	}

	// Ensure no duplicate messages by using message IDs
	const allMessages = [...initialMessages, ...streamingMessages].reduce((acc: Message[], message: Message) => {
		const exists = acc.find((m: Message) => m.id === message.id);
		if (!exists) {
			// Map tool_invocations to toolInvocations if it exists
			const mappedMessage = {
				...message,
				// @ts-ignore - handle snake_case to camelCase conversion
				toolInvocations: message.tool_invocations || message.toolInvocations || []
			};
			acc.push(mappedMessage);
		}
		return acc;
	}, [] as Message[]);

	const renderMessage = (message: Message) => {
		return (
			<motion.div
				key={message.id}
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -10 }}
				className={cn(
					"group relative w-full transition-all duration-300",
					message.role === "user"
						? "mb-8 hover:bg-muted/30 rounded-lg"
						: "mb-8 hover:bg-primary/5 rounded-lg"
				)}
			>
				<div className="flex items-start gap-4 px-4 py-4">
					<div className={cn(
						"min-w-[30px] text-sm font-medium",
						message.role === "user"
							? "text-muted-foreground"
							: "text-primary"
					)}>
						{message.role === "user" ? "You" : "AI"}
					</div>
					<div className="prose prose-neutral dark:prose-invert flex-1">
						<Markdown>{message.content}</Markdown>

						{/* Tool Invocations Display */}
						{message.toolInvocations?.map((tool: any, index: number) => {
							// Create a unique key that's stable across renders
							const uniqueKey = `${message.id}-${tool.toolCallId}-${index}`;

							// Map the backend format to what ToolInvocationDisplay expects
							return (
								<ToolInvocationDisplay
									key={uniqueKey}
									toolInvocation={{
										id: tool.toolCallId,
										toolCallId: tool.toolCallId,
										toolName: tool.toolName,
										args: tool.args,
										state: tool.state,
										result: tool.result
									}}
								/>
							);
						})}
					</div>
				</div>
			</motion.div>
		);
	};

	const renderStepProgress = () => (
		<div className="flex-none p-4 space-y-4 border-b">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-medium">
					Step {state.currentStep + 1} of {DOCUMENTATION_STEPS.length}:
					{DOCUMENTATION_STEPS[state.currentStep]?.title}
				</h3>
				<div className="flex items-center gap-2">
					{state.completedSteps.length > 0 && (
						<span className="text-sm text-muted-foreground">
							{state.completedSteps.length} completed
						</span>
					)}
				</div>
			</div>
			<div className="flex items-center gap-4">
				{DOCUMENTATION_STEPS.map((step, index) => (
					<div
						key={step.id}
						className={cn(
							"flex items-center gap-2",
							state.currentStep === index ? "text-primary" : "text-muted-foreground",
							state.completedSteps.includes(index) && "text-green-500"
						)}
					>
						<div className="w-8 h-8 rounded-full border flex items-center justify-center">
							{state.completedSteps.includes(index) ? (
								<CheckCircle className="w-4 h-4" />
							) : (
								step.id
							)}
						</div>
						<span className="text-sm font-medium">{step.title}</span>
					</div>
				))}
			</div>
		</div>
	);

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex-none p-4 space-y-4 border-b">
				<h2 className="text-lg font-semibold">Documentation Generator</h2>
				<p className="text-sm text-muted-foreground">
					Generating comprehensive documentation in {DOCUMENTATION_STEPS.length} steps
				</p>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={handleGenerateDoc}
						disabled={isLoading || state.currentStep >= DOCUMENTATION_STEPS.length}
					>
						{isLoading ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
								Generating Step {state.currentStep + 1}...
							</>
						) : state.currentStep >= DOCUMENTATION_STEPS.length ? (
							'Documentation Complete'
						) : state.currentStep === 0 ? (
							'Start Documentation'
						) : (
							'Continue Documentation'
						)}
					</Button>
					{isLoading && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => stop()}
							className="gap-2"
						>
							<Loader2 className="h-4 w-4 animate-spin" />
							Stop
						</Button>
					)}
				</div>
			</div>

			{renderStepProgress()}

			<ScrollArea className="flex-1 w-full h-[calc(100%-120px)]">
				<div ref={containerRef} className="p-4 space-y-4">
					<AnimatePresence mode="popLayout">
						{allMessages.map(renderMessage)}
					</AnimatePresence>

					{isLoading && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="flex items-center gap-2 text-muted-foreground"
						>
							<Bot className="h-4 w-4" />
							<span className="text-sm">
								Generating {DOCUMENTATION_STEPS[state.currentStep]?.title}...
							</span>
						</motion.div>
					)}
					<div ref={endRef} />
				</div>
			</ScrollArea>
		</div>
	);
}