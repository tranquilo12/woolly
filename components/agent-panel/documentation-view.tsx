'use client';

import { useAgentMessages } from '@/hooks/use-agent-messages';
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { documentationApi } from '@/lib/api/documentation';
import { AvailableRepository } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ToolInvocation } from '@ai-sdk/ui-utils';
import { useQuery } from '@tanstack/react-query';
import { Message } from "ai";
import { useChat } from 'ai/react';
import { AnimatePresence, motion } from "framer-motion";
import { Bot, CheckCircle, FileText, Play, Square } from "lucide-react";
import { useCallback, useEffect, useState, useMemo } from 'react';
import { DocumentationResult, isCodeDocumentation, isComponentAnalysis, isDevelopmentGuide, isMaintenanceOps, isSystemOverview } from '../../types/documentation';
import { MessageWithModel, toMessageWithModel } from "../chat";
import { Markdown } from "../markdown";
import { ToolInvocationDisplay } from "../tool-invocation";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { StrategySelector } from './strategy-selector';

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
		[key: string]: string;
		currentPrompt: string;
	};
}

interface StepConfig {
	id: number;
	title: string;
	prompt: string;
	description: string;
	requiresConfirmation: boolean;
}

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

// Update the validation helper to handle both parts and toolInvocations
const isValidDocumentationResponse = (message: Message): boolean => {
	// First check parts array (new format)
	// @ts-ignore
	if (message.parts?.length) {
		// @ts-ignore
		const hasValidToolResult = message.parts.some(part => {
			if (part.type !== 'tool-invocation') return false;
			const toolInvocation = (part as ToolInvocation);
			return (
				toolInvocation.toolName === 'final_result' &&
				toolInvocation.state === 'result' &&
				toolInvocation.args &&
				Object.keys(toolInvocation.args).length > 0
			);
		});
		if (hasValidToolResult) return true;
	}

	// Then check toolInvocations array (fallback format)
	if (message.toolInvocations?.length) {
		const hasValidToolResult = message.toolInvocations.some(tool => {
			return (
				tool.toolName === 'final_result' &&
				tool.state === 'result' &&
				tool.args &&
				Object.keys(tool.args).length > 0
			);
		});
		if (hasValidToolResult) return true;
	}

	// Finally check content for JSON format
	if (message.content?.trim()) {
		try {
			const parsedContent = JSON.parse(message.content);
			return Boolean(
				parsedContent.finishReason === "step_complete" &&
				parsedContent.context &&
				Object.keys(parsedContent.context).length > 0
			);
		} catch {
			return false;
		}
	}

	return false;
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
		context: {
			currentPrompt: ''
		}
	});

	const [currentStepContent, setCurrentStepContent] = useState<string>('');
	const [isStepComplete, setIsStepComplete] = useState<boolean>(false);
	const [selectedStrategy, setSelectedStrategy] = useState<string>("basic");

	// Fetch strategy details
	const { data: strategyDetails, isLoading: isLoadingStrategy } = useQuery({
		queryKey: ['documentation', 'strategy', selectedStrategy],
		queryFn: () => documentationApi.getStrategyDetails(selectedStrategy),
		enabled: !!selectedStrategy,
	});

	// Use strategy steps instead of DOCUMENTATION_STEPS
	const currentStep = strategyDetails?.steps[state.currentStep];

	// NEW: Define handleStepComplete early using useCallback so it's available for useChat.onFinish
	const handleStepComplete = useCallback((context: any) => {
		if (!strategyDetails?.steps) return;

		// Get current step model name to use as context key
		const currentStep = strategyDetails.steps[state.currentStep];
		if (!currentStep) return;

		const contextKey = currentStep.model.toLowerCase();

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

		// Update state with the content
		setState(prev => ({
			...prev,
			context: {
				...prev.context,
				[contextKey]: parsedContent,
				currentPrompt: currentStep?.prompt || ''
			},
			completedSteps: [...prev.completedSteps, prev.currentStep],
			currentStep: prev.currentStep + 1,
		}));

		setIsStepComplete(true);
		setCurrentStepContent('');
	}, [state.currentStep, currentStepContent, strategyDetails]);

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
		experimental_throttle: 50,
		id: chat_id,
		initialMessages: initialMessages || [],
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
		onToolCall: async (tool) => {
			// @ts-ignore
			setStreamingMessages(prevMessages => {
				const lastMessage = prevMessages[prevMessages.length - 1];
				if (!lastMessage) return prevMessages;

				const updatedToolInvocations = lastMessage.toolInvocations || (lastMessage as any).tool_invocations || [];
				const existingToolIndex = updatedToolInvocations.findIndex((t: any) =>
					t.type === 'tool-invocation' &&
					(t as ToolInvocation).toolCallId === tool.toolCall.toolCallId
				);

				if (existingToolIndex >= 0) {
					updatedToolInvocations[existingToolIndex] = {
						...updatedToolInvocations[existingToolIndex],
						toolCallId: tool.toolCall.toolCallId || (tool.toolCall as any).id,
						toolName: tool.toolCall.toolName,
						args: tool.toolCall.args,
					};
				} else {
					updatedToolInvocations.push({
						toolCallId: tool.toolCall.toolCallId || (tool.toolCall as any).id,
						toolName: tool.toolCall.toolName,
						args: tool.toolCall.args,
						// @ts-ignore Property 'state' does not exist on type 'ToolCall<string, unknown>'
						state: tool.toolCall.state || 'partial-call'
					});
				}

				return prevMessages.map((msg, i) =>
					i === prevMessages.length - 1
						? {
							...msg,
							parts: [
								// @ts-ignore
								...(msg.parts || []),
								{
									type: 'tool-invocation',
									toolInvocation: {
										toolCallId: tool.toolCall.toolCallId,
										toolName: tool.toolCall.toolName,
										args: tool.toolCall.args
									}
								}
							]
						}
						: msg
				);
			});
		},
		onFinish: async (message, { usage, finishReason }) => {
			if (finishReason === 'stop') {
				// Handle manual stop
				setIsStepComplete(false);
				return;
			}

			try {
				console.log("Finished message:", message);

				// Validate the response
				if (!isValidDocumentationResponse(message)) {
					console.warn("Invalid documentation response, retrying...");

					// Clear streaming messages and retry
					setStreamingMessages([]);

					// Small delay before retry
					await new Promise(resolve => setTimeout(resolve, 1000));

					// Retry the current step
					handleGenerateDoc();
					return;
				}

				// De-duplicate tool invocations based on args content
				const uniqueToolInvocations = message.toolInvocations?.reduce((acc: any[], tool: any) => {
					// Skip if we already have a tool with the same args
					const hasMatchingTool = acc.some(existingTool =>
						JSON.stringify(existingTool.args) === JSON.stringify(tool.args) &&
						existingTool.toolName === tool.toolName
					);

					if (!hasMatchingTool) {
						acc.push(tool);
					}
					return acc;
				}, []) || [];

				// Convert and save message with de-duplicated tool invocations
				const messageWithModel = toMessageWithModel({
					...message,
					toolInvocations: uniqueToolInvocations
				}, {
					promptTokens: usage?.promptTokens,
					completionTokens: usage?.completionTokens,
					totalTokens: usage?.totalTokens
				}, 'gpt-4o-mini');

				// Only save valid messages to DB
				await saveMessage({
					agentId: agent_id,
					chatId: chat_id,
					repository: repo_name,
					messageType: 'documentation',
					role: messageWithModel.role,
					content: messageWithModel.content || '',
					toolInvocations: uniqueToolInvocations.map(tool => ({
						toolCallId: tool.toolCallId || tool.id,
						toolName: tool.toolName,
						args: tool.args,
						state: tool.state,
						result: 'result' in tool ? tool.result : undefined
					}))
				});

				// Clear streaming messages after successful save
				setStreamingMessages([]);

				const hasCompletedToolInvocation = uniqueToolInvocations.some(
					tool => tool.toolName === 'final_result'
				);

				// Continue with existing logic...
				if (messageWithModel.content) {
					try {
						const parsedContent = JSON.parse(messageWithModel.content);
						if (parsedContent.finishReason === "step_complete") {
							handleStepComplete(parsedContent);
						}
					} catch (e) {
						console.error("Error parsing message content:", e);
						// Retry on parse error
						handleGenerateDoc();
					}
				} else if (hasCompletedToolInvocation) {
					const finalResultTool = uniqueToolInvocations.find(
						tool => tool.toolName === 'final_result'
					);

					// @ts-ignore
					if (finalResultTool?.result || finalResultTool?.args) {
						// @ts-ignore
						const formattedContent = formatToolResult(finalResultTool.result || finalResultTool.args, state.currentStep);
						const context = {
							context: {
								[state.currentStep]: formattedContent
							},
						};
						handleStepComplete(context);
					} else {
						// Retry if tool result is missing
						handleGenerateDoc();
					}
				} else {
					// Retry if no valid content or tool results
					handleGenerateDoc();
				}
			} catch (error) {
				console.error('Error in onFinish:', error);
				handleGenerateDoc();
			}
		},
	});

	// Fetch available strategies
	const {
		data: strategies,
		error: strategiesError,
		isLoading: isLoadingStrategies
	} = useQuery({
		queryKey: ['documentation', 'strategies'],
		queryFn: documentationApi.listStrategies,
	});

	// Handle strategy change
	const handleStrategyChange = useCallback((strategy: string) => {
		setSelectedStrategy(strategy);
		setState(prev => ({
			...prev,
			currentStep: 0,
			completedSteps: [],
		}));
	}, []);

	const handleGenerateDoc = useCallback(async () => {
		if (!strategyDetails?.steps) return;  // Early return if no steps

		if (isLoading) {
			stop();
			setIsStepComplete(false);
			return;
		}

		if (state.currentStep >= strategyDetails.steps.length) {
			return;
		}

		const currentStep = strategyDetails.steps[state.currentStep];
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
					context: {
						...state.context,
						current_step: state.currentStep,
						currentPrompt: currentStep.prompt,
					},
					prompt: currentStep.prompt,
					strategy: selectedStrategy,
				}
			});
		} catch (error) {
			console.error("Failed to generate documentation:", error);
			setIsStepComplete(false);
		}
	}, [append, state.currentStep, state.context, isLoading, chat_id, agent_id,
		repo_name, file_paths, initialMessages, stop, strategyDetails, selectedStrategy]);

	// Update useEffect to handle strategy loading safely
	useEffect(() => {
		if (!strategyDetails) return;  // Early return if no strategy details

		// Reset state when strategy changes
		setState({
			currentStep: 0,
			completedSteps: [],
			context: {
				currentPrompt: strategyDetails.steps[0]?.prompt || ''
			}
		});
	}, [selectedStrategy, strategyDetails]);

	// Place useEffect after handleGenerateDoc
	useEffect(() => {
		if (!isLoading && state.currentStep < (strategyDetails?.steps?.length || 0) && isStepComplete) {
			const timeoutId = setTimeout(() => {
				setIsStepComplete(false);
				handleGenerateDoc();
			}, 100);
			return () => clearTimeout(timeoutId);
		}
	}, [isStepComplete, state.currentStep, isLoading, handleGenerateDoc, strategyDetails]);

	// Update the message reduction to handle undefined initialMessages
	const allMessages = [...(initialMessages || []), ...streamingMessages].reduce((acc: MessageWithModel[], message: Message) => {
		// If message exists in initialMessages (DB), use that version
		const existingDbMessage = initialMessages?.find((m: MessageWithModel) => m.id === message.id);
		if (existingDbMessage) {
			if (!acc.some(m => m.id === existingDbMessage.id)) {
				acc.push(existingDbMessage);
			}
			return acc;
		}

		// Only add streaming message if it's not already in DB
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

	// Update step validation
	const isLastStep = useCallback(() => {
		if (!strategyDetails) return true;
		return state.currentStep >= strategyDetails.steps.length - 1;
	}, [state.currentStep, strategyDetails]);

	// Update progress display
	const progress = useMemo(() => {
		if (!strategyDetails) return 0;
		return (state.completedSteps.length / strategyDetails.steps.length) * 100;
	}, [state.completedSteps, strategyDetails]);

	// Update step buttons
	const getStepVariant = (index: number) => {
		if (state.currentStep === index) {
			return "default";
		} else if (state.completedSteps.includes(index)) {
			return "outline";
		} else {
			return "ghost";
		}
	};

	const handleStepClick = (index: number) => {
		if (!state.completedSteps.includes(index)) {
			setState(prev => ({
				...prev,
				currentStep: index,
			}));
		}
	};

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex-none p-6 border-b">
				<div className="flex flex-col space-y-4">
					{/* Title Section */}
					<div>
						<h2 className="text-xl font-semibold">Documentation Generator</h2>
						<p className="text-sm text-muted-foreground mt-1">
							Generating comprehensive documentation
						</p>
					</div>

					{/* Controls Section */}
					<div className="flex items-center justify-start gap-4">
						<StrategySelector
							value={selectedStrategy}
							onChange={handleStrategyChange}
							strategies={strategies || []}
						/>
						<Button
							size="lg"
							className={cn(
								"gap-2 transition-all min-w-[200px]",
								isLoading ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
							)}
							onClick={isLoading ? stop : handleGenerateDoc}
							disabled={!strategyDetails || state.currentStep >= strategyDetails.steps.length}
						>
							{isLoading ? (
								<>
									<Square className="h-4 w-4" />
									Stop Generation
								</>
							) : strategyDetails && state.currentStep >= strategyDetails.steps.length ? (
								<>
									<FileText className="h-4 w-4" />
									Documentation Complete
								</>
							) : (
								<>
									<Play className="h-4 w-4" />
									{state.currentStep === 0 ? 'Generate Documentation' : 'Continue Generation'}
								</>
							)}
						</Button>
					</div>
				</div>
			</div>

			{strategyDetails && (
				<div className="flex-none p-4 space-y-4 border-b">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-sm font-medium">
							{currentStep?.title}
						</h3>
					</div>
					<div className="flex items-center gap-4">
						{strategyDetails.steps.map((step, index) => (
							<Button
								key={step.id}
								variant={getStepVariant(index)}
								size="sm"
								className={cn(
									"relative",
									state.currentStep === index && "animate-pulse"
								)}
								onClick={() => handleStepClick(index)}
								disabled={!state.completedSteps.includes(index) && index !== state.currentStep}
							>
								{step.title}
								{state.completedSteps.includes(index) && (
									<CheckCircle className="ml-2 h-4 w-4" />
								)}
							</Button>
						))}
					</div>
				</div>
			)}

			<ScrollArea className="flex-1 w-full h-[calc(100%-180px)]">
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
								{currentStep ? `Generating ${currentStep.title}...` : 'Loading...'}
							</span>
						</motion.div>
					)}
					<div ref={endRef} />
				</div>
			</ScrollArea>
		</div>
	);
}