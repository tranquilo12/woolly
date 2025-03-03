'use client';

import { useAgentMessages } from '@/hooks/use-agent-messages';
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { documentationApi } from '@/lib/api/documentation';
import { AvailableRepository } from "@/lib/constants";
import { ToolInvocation } from '@ai-sdk/ui-utils';
import { useQuery } from '@tanstack/react-query';
import { Message } from "ai";
import { useChat } from 'ai/react';
import { CheckCircle, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useCallback, useEffect, useState, useMemo } from 'react';
import { DocumentationResult, isCodeDocumentation, isComponentAnalysis, isDevelopmentGuide, isMaintenanceOps, isSystemOverview } from '../../types/documentation';
import { MessageWithModel, toMessageWithModel } from "../chat";
import { Button } from "../ui/button";
import { StrategySelector } from './strategy-selector';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { AgentMessageGroup } from './message-group';
import { DocumentationGraph } from '../documentation/graph/DocumentationGraph';
import 'reactflow/dist/style.css';

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

export function DocumentationView({ repo_name, agent_id, file_paths, chat_id }: DocumentationViewProps) {
	const [containerRef, endRef, scrollToBottom] = useScrollToBottom<HTMLDivElement>();

	// Ensure agent_id is always a string
	const safeAgentId = agent_id ? String(agent_id) : '';

	const {
		data: initialMessages = [],
		isError,
		isLoading: isLoadingInitial,
		saveMessage,
		groupedMessages
	} = useAgentMessages(
		chat_id,
		safeAgentId,
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
	const [isAgentReady, setIsAgentReady] = useState(false);

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
		api: `/api/agents/${safeAgentId}/documentation`,
		experimental_throttle: 50,
		id: chat_id,
		initialMessages: initialMessages || [],
		body: {
			id: chat_id,
			messages: initialMessages || [],
			model: "gpt-4o-mini",
			agent_id: safeAgentId,
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
					agentId: safeAgentId,
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
					agent_id: safeAgentId,
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
	}, [append, state.currentStep, state.context, isLoading, chat_id, safeAgentId,
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

	// Add message processing logic
	const processedMessages = useMemo(() => {
		const messages = [...(initialMessages || []), ...(streamingMessages || [])];
		return messages.reduce((acc: MessageWithModel[], message: Message) => {
			// Avoid duplicates
			const exists = acc.find((m) => m.id === message.id);
			if (!exists) {
				// Convert to MessageWithModel format
				acc.push({
					...message,
					toolInvocations: (message as any).tool_invocations || [],
					model: (message as any).model || 'gpt-4o-mini',
					data: { dbId: message.id },
				} as MessageWithModel);
			}
			return acc;
		}, [] as MessageWithModel[]);
	}, [initialMessages, streamingMessages]);

	// Move formatToolResult inside the component and memoize it
	const formatToolResult = useCallback((result: DocumentationResult, step: number): string => {
		try {
			// Parse result if it's a string
			const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;

			// Debug the result structure
			console.log(`[DEBUG] formatToolResult for step ${step}:`, {
				resultType: typeof result,
				parsedResultKeys: Object.keys(parsedResult),
				isSystemOverview: isSystemOverview(parsedResult),
				isComponentAnalysis: isComponentAnalysis(parsedResult),
				isCodeDocumentation: isCodeDocumentation(parsedResult),
				isDevelopmentGuide: isDevelopmentGuide(parsedResult),
				isMaintenanceOps: isMaintenanceOps(parsedResult),
			});

			if (isSystemOverview(parsedResult) ||
				('architecture_diagram' in parsedResult && 'core_technologies' in parsedResult)) {
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
					parsedResult.system_requirements?.map((req: string) => `- ${req}`).join('\n') || '',
					"\n## Project Structure",
					"```",
					parsedResult.project_structure,
					"```"
				].join('\n');
			}

			if (isComponentAnalysis(parsedResult) ||
				('component_name' in parsedResult && 'description' in parsedResult)) {
				// Ensure dependencies exists
				const dependencies = parsedResult.dependencies || [];

				return [
					`# Component: ${parsedResult.component_name}\n`,
					`## Description\n${parsedResult.description}\n`,
					"## Dependencies",
					Array.isArray(dependencies)
						? dependencies.map((dep: string) => `- ${dep}`).join('\n')
						: "No dependencies specified",
					"## Dependencies Details",
					typeof parsedResult.dependencies === 'object' && !Array.isArray(parsedResult.dependencies)
						? Object.entries(parsedResult.dependencies)
							.map(([key, value]) => `### ${key}\n${value}`)
							.join('\n\n')
						: ""
				].join('\n');
			}

			if (isCodeDocumentation(parsedResult) || 'code_module' in parsedResult) {
				const modules = Array.isArray(parsedResult.code_module) ? parsedResult.code_module : [parsedResult.code_module];
				const formattedModules = modules.map((module: any) => {
					const deps = Array.isArray(module.dependencies) ? module.dependencies : [module.dependencies || 'No dependencies'];
					const examples = Array.isArray(module.usage_examples) ? module.usage_examples : [module.usage_examples || 'No examples'];
					return [
						`### ${module.name}`,
						module.purpose,
						'',
						'Dependencies:',
						deps.map((dep: string) => `- ${dep}`).join('\n'),
						'',
						'Usage Examples:',
						examples.map((ex: string) => '```\n' + ex + '\n```').join('\n')
					].join('\n');
				});

				return [
					"# Code Documentation",
					"",
					"## Modules",
					"",
					formattedModules.join('\n\n')
				].join('\n');
			}

			if (isDevelopmentGuide(parsedResult) ||
				('workflow_documentation' in parsedResult && 'setup_instructions' in parsedResult)) {
				return [
					"# Development Guide\n",
					"## Setup",
					parsedResult.setup_instructions,
					"\n## Workflow",
					parsedResult.workflow_documentation,
					"\n## Guidelines",
					parsedResult.guidelines?.map((guideline: string) => `- ${guideline}`).join('\n') || ''
				].join('\n');
			}

			if (isMaintenanceOps(parsedResult) || ('maintenance_procedures' in parsedResult && 'troubleshooting_guide' in parsedResult)) {
				const procedures = Array.isArray(parsedResult.maintenance_procedures)
					? parsedResult.maintenance_procedures
					: [parsedResult.maintenance_procedures || 'No procedures specified'];

				const troubleshooting = Object.entries(parsedResult.troubleshooting_guide || {})
					.map(([key, value]) => `### ${key}\n${value}`)
					.join('\n\n');

				return [
					"# Maintenance & Operations",
					"",
					"## Procedures",
					procedures.map((proc: string) => `- ${proc}`).join('\n'),
					"",
					"## Troubleshooting",
					troubleshooting,
					"",
					"## Operations",
					parsedResult.operations || 'No operations specified'
				].join('\n');
			}

			// Fallback for unhandled cases
			console.log("[DEBUG] No specific formatter matched, using JSON stringify");
			return JSON.stringify(parsedResult, null, 2);

		} catch (error) {
			console.error('Error formatting tool result:', error);
			return String(result);
		}
	}, []); // Empty dependency array since it doesn't depend on any props or state

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


	// Helper function to get document type name based on step index
	const getDocumentTypeName = (index: number): string => {
		if (!strategyDetails?.steps || index >= strategyDetails.steps.length) {
			return "Unknown";
		}

		const step = strategyDetails.steps[index];

		// Map step titles to more user-friendly names if needed
		switch (index) {
			case 0: return "System Overview";
			case 1: return "Component Analysis";
			case 2: return "Code Documentation";
			case 3: return "Development Guide";
			case 4: return "Maintenance Ops";
			default: return step.title || `Step ${index + 1}`;
		}
	};


	const handleStepClick = (index: number) => {
		// Always allow changing steps via the document type buttons
		setState(prev => ({
			...prev,
			currentStep: index,
		}));

		// If we're generating a new document, trigger the generation
		if (!groupedMessages[index] || !groupedMessages[index].messages?.length) {
			// Small delay to allow state update to complete
			setTimeout(() => {
				handleGenerateDoc();
			}, 100);
		}
	};

	useEffect(() => {
		const setupDocumentationAgent = async () => {
			if (!repo_name || isAgentReady) return;

			try {
				// First try to get existing agent
				const getResponse = await fetch(`/api/agents?repository=${repo_name}&type=documentation`);

				if (getResponse.ok) {
					const agents = await getResponse.json();
					if (agents.length > 0) {
						// Use existing agent
						localStorage.setItem(`doc_agent_${repo_name}`, agents[0].id);
						setIsAgentReady(true);
						return;
					}
				}

				// If no existing agent, create new one
				const createResponse = await fetch('/api/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: `Documentation Agent for ${repo_name}`,
						description: 'This agent is created for documentation generation',
						type: 'documentation',
						repository: repo_name,
						agent_id: safeAgentId,
						file_paths: file_paths,
						chat_id: chat_id,
					}),
				});

				if (createResponse.ok) {
					const newAgent = await createResponse.json();
					localStorage.setItem(`doc_agent_${repo_name}`, newAgent.id);
					setIsAgentReady(true);
				}
			} catch (error) {
				console.error('Error setting up documentation agent:', error);
				setIsAgentReady(false);
			}
		};

		setupDocumentationAgent();
	}, [repo_name, safeAgentId, file_paths, chat_id, isAgentReady]);

	return (
		<div className="flex flex-col h-full">
			<div className="flex-1 overflow-y-auto" ref={containerRef}>
				{/* Strategy selector and Generate button */}
				<div className="p-4 border-b">
					<div className="flex items-center justify-between gap-4">
						<StrategySelector
							value={selectedStrategy}
							onChange={handleStrategyChange}
							strategies={strategies || []}
						/>
						<Button
							onClick={handleGenerateDoc}
							disabled={isLoading || !strategyDetails}
							className="flex items-center gap-2"
						>
							{isLoading ? (
								<>
									<Skeleton className="h-4 w-4" />
									Generating...
								</>
							) : (
								<>
									<Play className="h-4 w-4" />
									Generate
								</>
							)}
						</Button>
					</div>
				</div>

				{/* Graph View */}
				<div className="p-4 border-b">
					<DocumentationGraph
						steps={strategyDetails?.steps || []}
						currentStep={state.currentStep}
						completedSteps={state.completedSteps}
						onStepClick={handleStepClick}
					/>
				</div>

				{/* Documentation content */}
				<div className="p-4 space-y-6">
					{groupedMessages.map((group, index) => (
						<AgentMessageGroup
							key={`${group.step_index}-${group.iteration_index}`}
							group={group}
							currentStep={state.currentStep}
							onStepClick={handleStepClick}
						/>
					))}
				</div>

				{/* Loading state */}
				{isLoading && (
					<div className="p-4">
						<Skeleton className="h-24 w-full" />
					</div>
				)}

				{/* Error state */}
				{isError && (
					<div className="p-4 text-red-500">
						Error loading documentation. Please try again.
					</div>
				)}

				{/* Empty state */}
				{!isLoading && !isError && groupedMessages.length === 0 && (
					<div className="p-4 text-center text-muted-foreground">
						No documentation generated yet. Click the Generate button to begin.
					</div>
				)}

				<div ref={endRef} />
			</div>
		</div>
	);
}