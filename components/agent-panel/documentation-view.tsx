'use client';

import { useChat } from 'ai/react';
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Bot, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvailableRepository } from "@/lib/constants";
import { Message, LanguageModelUsage } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { Markdown } from "../markdown";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { useState, useEffect, useCallback } from 'react';
import { ToolInvocationDisplay } from "../tool-invocation";
import { isSystemOverview, isComponentAnalysis, isCodeDocumentation, isDevelopmentGuide, isMaintenanceOps, DocumentationResult } from '../../types/documentation';
import { MessageWithModel, toMessage, toMessageWithModel } from "../chat";

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
		currentPrompt?: string;
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

const formatToolResult = (result: DocumentationResult, step: number): string => {
	try {
		// Parse result if it's a string
		const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;

		switch (step) {
			case 0: {
				if (isSystemOverview(parsedResult)) {
					return [
						"# System Overview\n",
						"## Architecture Diagram",
						"```mermaid",
						parsedResult.architecture_diagram,
						"```\n",
						"## Core Technologies",
						parsedResult.core_technologies.map((tech: string) => `- ${tech}`).join('\n'),
						"\n## Design Patterns",
						parsedResult.design_patterns.map((pattern: string) => `- ${pattern}`).join('\n'),
						"\n## System Requirements",
						parsedResult.system_requirements.map((req: string) => `- ${req}`).join('\n'),
						"\n## Project Structure",
						"```",
						parsedResult.project_structure,
						"```"
					].join('\n');
				}
				break;
			}
			case 1: {
				if (isComponentAnalysis(parsedResult)) {
					return [
						`# Component: ${parsedResult.name}\n`,
						`## Purpose\n${parsedResult.purpose}\n`,
						"## Dependencies",
						parsedResult.dependencies.map(dep => `- ${dep}`).join('\n'),
						"\n## Relationships Diagram",
						"```mermaid",
						parsedResult.relationships_diagram,
						"```\n",
						"## Technical Details",
						Object.entries(parsedResult.technical_details)
							.map(([key, value]) => `### ${key}\n${value}`)
							.join('\n\n'),
						"\n## Integration Points",
						parsedResult.integration_points.map(point => `- ${point}`).join('\n')
					].join('\n');
				}
				break;
			}
			case 2: {
				if (isCodeDocumentation(parsedResult)) {
					return [
						"# Code Documentation\n",
						"## Modules",
						parsedResult.modules.map(module =>
							`### ${module.name}\n${module.purpose}\n\nDependencies:\n${module.dependencies.map((dep: string) => `- ${dep}`).join('\n')
							}\n\nUsage Examples:\n${module.usage_examples.map((ex: string) => `\`\`\`\n${ex}\n\`\`\``).join('\n')
							}`
						).join('\n\n'),
						"\n## Patterns",
						parsedResult.patterns.map(pattern => `- ${pattern}`).join('\n'),
						"\n## Usage Examples",
						parsedResult.usage_examples.map(ex => `\`\`\`\n${ex}\n\`\`\``).join('\n'),
						parsedResult.api_specs ? [
							"\n## API Specifications",
							"### Endpoints",
							parsedResult.api_specs.endpoints.map((ep: string) => `- ${ep}`).join('\n'),
							"\n### Authentication",
							parsedResult.api_specs.authentication,
							"\n### Error Handling",
							parsedResult.api_specs.error_handling
						].join('\n') : ''
					].join('\n');
				}
				break;
			}
			case 3: {
				if (isDevelopmentGuide(parsedResult)) {
					return [
						"# Development Guide\n",
						"## Setup",
						parsedResult.setup,
						"\n## Workflow",
						parsedResult.workflow,
						"\n## Guidelines",
						parsedResult.guidelines.map((guideline: string) => `- ${guideline}`).join('\n')
					].join('\n');
				}
				break;
			}
			case 4: {
				if (isMaintenanceOps(parsedResult)) {
					return [
						"# Maintenance & Operations\n",
						"## Procedures",
						parsedResult.procedures.map((proc: string) => `- ${proc}`).join('\n'),
						"\n## Troubleshooting",
						Object.entries(parsedResult.troubleshooting)
							.map(([key, value]) => `### ${key}\n${value}`)
							.join('\n\n'),
						"\n## Operations",
						parsedResult.operations
					].join('\n');
				}
				break;
			}
		}

		// Fallback for unhandled cases
		return JSON.stringify(parsedResult, null, 2);
	} catch (error) {
		console.error('Error formatting tool result:', error);
		return String(result);
	}
};

export function DocumentationView({ repo_name, agent_id, file_paths, chat_id }: DocumentationViewProps) {
	const [containerRef, endRef, scrollToBottom] = useScrollToBottom<HTMLDivElement>();
	const {
		data: initialMessages,
		isError,
		isLoading: isLoadingInitial,
		saveMessage
	} = useAgentMessages(
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

		const contextKeyMap: { [key: number]: string } = {
			0: 'systemOverview',
			1: 'componentAnalysis',
			2: 'codeDocumentation',
			3: 'developmentGuides',
			4: 'maintenanceOps'
		};

		const contextKey = contextKeyMap[state.currentStep];

		// Get content either from context parameter or currentStepContent
		let parsedContent: any;
		try {
			// Prefer context overview if available
			if (context?.context?.[contextKey]) {
				parsedContent = context.context[contextKey];
				// If it's a string that looks like JSON, try to parse it
				if (typeof parsedContent === 'string' && parsedContent.trim().startsWith('{')) {
					parsedContent = JSON.parse(parsedContent);
				}
			} else if (currentStepContent) {
				// If currentStepContent looks like JSON, parse it
				if (currentStepContent.trim().startsWith('{')) {
					try {
						parsedContent = JSON.parse(currentStepContent);
					} catch (e) {
						console.warn('Failed to parse currentStepContent as JSON:', e);
						parsedContent = currentStepContent;
					}
				} else {
					parsedContent = currentStepContent;
				}
			} else {
				parsedContent = {};
			}
		} catch (error) {
			console.error('Error parsing content:', error);
			parsedContent = {};
		}

		// Format the content based on the step
		let formattedContent: string;
		try {
			formattedContent = formatToolResult(parsedContent, state.currentStep);
		} catch (error) {
			console.error('Error formatting content:', error);
			formattedContent = typeof parsedContent === 'string' ?
				parsedContent :
				JSON.stringify(parsedContent, null, 2);
		}

		// Update state with the formatted content
		setState(prev => ({
			...prev,
			context: {
				...prev.context,
				[contextKey]: formattedContent,
				currentPrompt: DOCUMENTATION_STEPS[prev.currentStep].prompt
			},
			completedSteps: [...prev.completedSteps, prev.currentStep],
			currentStep: prev.currentStep + 1,
		}));

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
			console.log('Tool call received:', toolCall);
			try {
				setStreamingMessages(prevMessages => {
					const lastMessage = prevMessages[prevMessages.length - 1];
					if (!lastMessage) return prevMessages;

					// @ts-ignore
					const updatedToolInvocations = lastMessage.toolInvocations || lastMessage.tool_invocations || [];
					const existingToolIndex = updatedToolInvocations.findIndex(
						(t: any) => t.toolCallId === toolCall.toolCallId
					);

					// First send empty partial call
					const initialToolCall = {
						toolCallId: toolCall.toolCallId,
						toolName: toolCall.toolName,
						args: {},
						state: 'partial-call' as const
					};

					// If we have args, validate them as complete JSON before including
					if (toolCall.args) {
						try {
							const argsStr = JSON.stringify(toolCall.args);
							if (argsStr.startsWith('{') && argsStr.endsWith('}')) {
								initialToolCall.args = toolCall.args;
							}
						} catch (e) {
							console.error('Invalid JSON in tool args:', e);
						}
					}

					if (existingToolIndex >= 0) {
						updatedToolInvocations[existingToolIndex] = {
							...updatedToolInvocations[existingToolIndex],
							...initialToolCall
						};
					} else {
						updatedToolInvocations.push(initialToolCall);
					}

					return prevMessages.map((msg, i) =>
						i === prevMessages.length - 1
							? { ...msg, toolInvocations: updatedToolInvocations }
							: msg
					);
				});
			} catch (e) {
				console.error('Error in onToolCall:', e);
			}
		},
		onFinish: async (message) => {
			try {
				console.log("Finished message:", message);

				// Convert and save message
				const messageWithModel = toMessageWithModel(message, {
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0
				}, 'gpt-4o');

				// Save message to DB
				await saveMessage({
					agentId: agent_id,
					chatId: chat_id,
					repository: repo_name,
					messageType: 'documentation',
					role: messageWithModel.role,
					content: messageWithModel.content || '',
					toolInvocations: messageWithModel.toolInvocations?.map(tool => ({
						toolCallId: tool.toolCallId,
						toolName: tool.toolName,
						args: tool.args,
						state: tool.state,
						result: 'result' in tool ? tool.result : undefined
					})) || []
				});

				// Reset streaming messages - this will force the UI to use DB messages
				setStreamingMessages([]);

				// Handle step completion
				const hasCompletedToolInvocation = messageWithModel.toolInvocations?.some(
					tool => tool.toolName === 'final_result'
				);

				if (messageWithModel.content) {
					try {
						const parsedContent = JSON.parse(messageWithModel.content);
						if (parsedContent.finishReason === "step_complete") {
							handleStepComplete(parsedContent);
						}
					} catch (e) {
						console.error("Error parsing message content:", e);
					}
				} else if (hasCompletedToolInvocation) {
					const finalResultTool = messageWithModel.toolInvocations?.find(
						tool => tool.toolName === 'final_result'
					);

					// @ts-ignore
					if (finalResultTool?.result) {
						// @ts-ignore
						const formattedContent = formatToolResult(finalResultTool.result, state.currentStep);
						const context = {
							context: {
								[state.currentStep]: formattedContent
							},
						};
						handleStepComplete(context);
					}
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
			// Ensure we're sending the current step's prompt
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
					context: {
						...state.context,
						current_step: state.currentStep,
						currentPrompt: currentStep.prompt, // Add the current prompt to context
					},
					prompt: currentStep.prompt, // Add the prompt directly to the request
				}
			});

		} catch (error) {
			console.error("Failed to generate documentation:", error);
			setIsStepComplete(false);
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

	// Update the message reduction to prefer DB messages over streaming ones
	const allMessages = [...initialMessages, ...streamingMessages].reduce((acc: MessageWithModel[], message: Message) => {
		// If message exists in initialMessages (DB), skip the streaming version
		const existingDbMessage = initialMessages.find((m: MessageWithModel) => m.id === message.id);
		if (existingDbMessage) {
			if (!acc.some(m => m.id === existingDbMessage.id)) {
				acc.push(existingDbMessage);
			}
			return acc;
		}

		// Only add streaming message if it's not already saved to DB
		if (!acc.some(m => m.id === message.id)) {
			const messageWithModel = toMessageWithModel(message, null);
			acc.push(messageWithModel);
		}
		return acc;
	}, [] as MessageWithModel[]);

	const renderMessage = (message: MessageWithModel) => {
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

						{/* Handle both toolInvocations and tool_invocations */}
						{(message.toolInvocations || (message as any).tool_invocations)?.map((tool: any, index: number) => {
							// Create a unique key that's stable across renders
							const uniqueKey = `${message.id}-${tool.toolCallId || 'tool'}-${index}`;

							return (
								<ToolInvocationDisplay
									key={uniqueKey}
									toolInvocation={{
										id: tool.toolCallId,
										toolCallId: tool.toolCallId,
										toolName: tool.toolName,
										args: tool.args,
										state: tool.state,
										result: 'result' in tool ? tool.result : undefined
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