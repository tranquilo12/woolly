'use client';

import { useAgentMessages } from '@/hooks/use-agent-messages';
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { documentationApi } from '@/lib/api/documentation';
import { AvailableRepository } from "@/lib/constants";
import { ToolInvocation } from '@ai-sdk/ui-utils';
import { useQuery } from '@tanstack/react-query';
import { Message } from "ai";
import { useChat } from 'ai/react';
import { Play, Loader2, Square, Settings, ChevronUp, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState, useMemo } from 'react';
import { DocumentationResult, isCodeDocumentation, isComponentAnalysis, isDevelopmentGuide, isMaintenanceOps, isSystemOverview } from '../../types/documentation';
import { MessageWithModel, toMessageWithModel } from "../chat";
import { Button } from "../ui/button";
import { StrategySelector } from './strategy-selector';
import { AgentMessageGroup } from './message-group';
import { PipelineFlow } from './pipeline-flow';
import 'reactflow/dist/style.css';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
	stepResults: Record<string, any>;
	version: number;
	history: Array<{
		version: number;
		stepResults: Record<string, any>;
		completedSteps: number[];
	}>;
}

interface StepConfig {
	id: number;
	title: string;
	prompt: string;
	description: string;
	requiresConfirmation: boolean;
	model: string;
}

function EmptyPipelineState({ pipelineName, onStart }: { pipelineName: string, onStart: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center h-full p-8 text-center">
			<div className="rounded-full bg-primary/10 p-4 mb-4">
				<Play className="h-6 w-6 text-primary" />
			</div>
			<h3 className="text-lg font-medium mb-2">Ready to Generate Documentation</h3>
			<p className="text-sm text-muted-foreground mb-6 max-w-md">
				You&apos;ve selected the &ldquo;{pipelineName}&rdquo; pipeline. Click the button below to start generating documentation for your project.
			</p>
			<Button onClick={onStart} className="flex items-center gap-2">
				<Play className="h-4 w-4" />
				Start Pipeline
			</Button>
		</div>
	);
}

export function DocumentationView({ repo_name, agent_id, file_paths, chat_id }: DocumentationViewProps) {
	const [containerRef, endRef, scrollToBottom] = useScrollToBottom<HTMLDivElement>();

	// Add state for collapsible settings region
	const [isSettingsExpanded, setIsSettingsExpanded] = useState<boolean>(true);

	// Toggle settings expansion
	const toggleSettings = useCallback(() => {
		setIsSettingsExpanded(prev => !prev);
	}, []);

	// Ensure agent_id is always a string
	const safeAgentId = agent_id ? String(agent_id) : '';

	const [selectedStrategy, setSelectedStrategy] = useState<string>("basic");

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
		'documentation',
		selectedStrategy // Pass the selected strategy as the pipeline_id
	);

	const [state, setState] = useState<DocumentationState>({
		currentStep: 0,
		completedSteps: [],
		context: {
			currentPrompt: ''
		},
		stepResults: {},
		version: 1,
		history: []
	});

	const [currentStepContent, setCurrentStepContent] = useState<string>('');
	const [isStepComplete, setIsStepComplete] = useState<boolean>(false);
	const [isAgentReady, setIsAgentReady] = useState(!!safeAgentId);

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
		const stepKey = `step-${state.currentStep}`;

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
			stepResults: {
				...prev.stepResults,
				[stepKey]: parsedContent
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
			context: state.context || {},
			strategy: selectedStrategy,
			pipeline_id: selectedStrategy
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

				// Add this line to reset the isGenerationStopped state
				setIsGenerationStopped(false);

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

				// Get current step details for metadata
				const currentStepDetails = strategyDetails?.steps[state.currentStep];
				const stepTitle = currentStepDetails?.title || `Step ${state.currentStep + 1}`;

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
					chatId: chat_id,
					agentId: safeAgentId,
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
					})),
					iteration_index: 0,  // First iteration
					step_index: state.currentStep,
					step_title: stepTitle,
					pipeline_id: selectedStrategy
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

	// Add a handleStrategyChange function to reset messages when the strategy changes
	const handleStrategyChange = (newStrategy: string) => {
		// Update the selected strategy
		setSelectedStrategy(newStrategy);

		// Reset the state to start from the beginning
		setState({
			currentStep: 0,
			completedSteps: [],
			context: {
				currentPrompt: ''
			},
			stepResults: {},
			version: 1,
			history: []
		});

		// Clear streaming messages
		setStreamingMessages([]);
	};

	const handleGenerateDoc = useCallback(async () => {
		if (isLoading || !strategyDetails) return;

		// Save current state to history before generating new content
		if (state.completedSteps.length > 0) {
			setState(prev => ({
				...prev,
				history: [
					...prev.history,
					{
						version: prev.version,
						stepResults: { ...prev.stepResults },
						completedSteps: [...prev.completedSteps]
					}
				],
				version: prev.version + 1
			}));
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
					pipeline_id: selectedStrategy,
				}
			});
		} catch (error) {
			console.error("Failed to generate documentation:", error);
			// Add more detailed error logging
			if (error instanceof Error) {
				console.error("Error message:", error.message);
				console.error("Error stack:", error.stack);
			}
			// If it's a response error, try to get more details
			if (error instanceof Response || (error as any)?.response) {
				const response = error instanceof Response ? error : (error as any).response;
				console.error("Response status:", response.status);
				console.error("Response statusText:", response.statusText);
				// Try to get the response body
				response.text().then((text: string) => {
					console.error("Response body:", text);
				}).catch((e: any) => {
					console.error("Failed to get response body:", e);
				});
			}
			setIsStepComplete(false);
		}

		// Add this line to reset the isGenerationStopped state
		setIsGenerationStopped(false);
	}, [isLoading, strategyDetails, state.completedSteps.length, state.currentStep, state.context, append, chat_id, initialMessages, safeAgentId, repo_name, file_paths, selectedStrategy]);

	// Update useEffect to handle strategy loading safely
	useEffect(() => {
		if (!strategyDetails) return;  // Early return if no strategy details

		// Reset state when strategy changes
		setState({
			currentStep: 0,
			completedSteps: [],
			context: {
				currentPrompt: strategyDetails.steps[0]?.prompt || ''
			},
			stepResults: {},
			version: 1,
			history: []
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
					Array.isArray(parsedResult.core_technologies)
						? parsedResult.core_technologies.map((tech: string) => `- ${tech}`).join('\n')
						: "No core technologies specified",
					"\n## Design Patterns",
					Array.isArray(parsedResult.design_patterns)
						? parsedResult.design_patterns.map((pattern: string) => `- ${pattern}`).join('\n')
						: "No design patterns specified",
					"\n## System Requirements",
					Array.isArray(parsedResult.system_requirements)
						? parsedResult.system_requirements.map((req: string) => `- ${req}`).join('\n')
						: "No system requirements specified",
					"\n## Project Structure",
					"```",
					parsedResult.project_structure || "No project structure specified",
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
						? Object.entries(parsedResult.dependencies || {})
							.map(([key, value]) => `### ${key}\n${value}`)
							.join('\n\n')
						: ""
				].join('\n');
			}

			if (isCodeDocumentation(parsedResult) || 'code_module' in parsedResult) {
				const modules = Array.isArray(parsedResult.code_module)
					? parsedResult.code_module
					: (parsedResult.code_module ? [parsedResult.code_module] : []);

				if (modules.length === 0) {
					return "# Code Documentation\n\nNo code modules found.";
				}

				const formattedModules = modules.map((module: any) => {
					const deps = Array.isArray(module?.dependencies)
						? module.dependencies
						: (module?.dependencies ? [module.dependencies] : ['No dependencies']);

					const examples = Array.isArray(module?.usage_examples)
						? module.usage_examples
						: (module?.usage_examples ? [module.usage_examples] : ['No examples']);

					return [
						`### ${module?.name || 'Unnamed Module'}`,
						module?.purpose || 'No purpose specified',
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
					parsedResult.setup_instructions || "No setup instructions provided",
					"\n## Workflow",
					parsedResult.workflow_documentation || "No workflow documentation provided",
					"\n## Guidelines",
					Array.isArray(parsedResult.guidelines)
						? parsedResult.guidelines.map((guideline: string) => `- ${guideline}`).join('\n')
						: "No guidelines specified"
				].join('\n');
			}

			if (isMaintenanceOps(parsedResult) || ('maintenance_procedures' in parsedResult && 'troubleshooting_guide' in parsedResult)) {
				const procedures = Array.isArray(parsedResult.maintenance_procedures)
					? parsedResult.maintenance_procedures
					: (parsedResult.maintenance_procedures ? [parsedResult.maintenance_procedures] : ['No procedures specified']);

				const troubleshootingGuide = parsedResult.troubleshooting_guide || {};
				const troubleshooting = Object.entries(troubleshootingGuide)
					.map(([key, value]) => `### ${key}\n${value}`)
					.join('\n\n');

				return [
					"# Maintenance & Operations",
					"",
					"## Procedures",
					procedures.map((proc: string) => `- ${proc}`).join('\n'),
					"",
					"## Troubleshooting",
					troubleshooting || "No troubleshooting guide specified",
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

	// Move the setupDocumentationAgent function outside of the useEffect
	const setupDocumentationAgent = useCallback(async () => {
		// If we already have an agent_id, we're ready
		if (safeAgentId) {
			setIsAgentReady(true);
			return;
		}

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

			// If no existing agent, create a new one
			const createResponse = await fetch('/api/agents', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: `${repo_name} Documentation Agent`,
					description: `Agent for generating documentation for ${repo_name}`,
					system_prompt: 'You are a documentation agent that helps generate comprehensive documentation for code repositories.',
					tools: ['codebase_search', 'read_file', 'fetch_repo_content'],
					repository: repo_name,
				}),
			});

			if (createResponse.ok) {
				const newAgent = await createResponse.json();
				localStorage.setItem(`doc_agent_${repo_name}`, newAgent.id);
				setIsAgentReady(true);
			} else {
				console.error('Failed to create documentation agent');
			}
		} catch (error) {
			console.error('Error setting up documentation agent:', error);
		}
	}, [repo_name, isAgentReady, safeAgentId]);

	// Update the useEffect that calls setupDocumentationAgent to run when safeAgentId changes
	useEffect(() => {
		setupDocumentationAgent();
	}, [setupDocumentationAgent, safeAgentId]);

	const handleStartPipeline = () => {
		// Reset state to start from the beginning
		setState({
			currentStep: 0,
			completedSteps: [],
			context: {
				currentPrompt: ''
			},
			stepResults: {},
			version: 1,
			history: []
		});

		// Start the pipeline
		setupDocumentationAgent();

		// Generate the first step after a short delay to ensure agent is ready
		setTimeout(() => {
			handleGenerateDoc();
		}, 500);
	};

	// Add a new state variable to track if generation is stopped
	const [isGenerationStopped, setIsGenerationStopped] = useState(false);

	// Update the handleStopGeneration function to remove the toast
	const handleStopGeneration = useCallback(() => {
		// Stop the current generation
		stop();
		setIsGenerationStopped(true);

		// We could add visual feedback here in the future
	}, [stop]);

	// Update the handleContinueGeneration function
	const handleContinueGeneration = useCallback(() => {
		setIsGenerationStopped(false);
		// Continue with the current step
		handleGenerateDoc();

		// We could add visual feedback here in the future
	}, [handleGenerateDoc]);

	// Add a function to handle restarting the flow
	const handleRestartFlow = useCallback(() => {
		if (isLoading) return;

		// Reset state
		setState({
			currentStep: 0,
			completedSteps: [],
			context: {
				currentPrompt: strategyDetails?.steps[0]?.prompt || '',
			},
			stepResults: {},
			version: 1,
			history: []
		});

		// Clear messages
		setStreamingMessages([]);

		// Show confirmation
		toast.success("Pipeline restarted");
	}, [isLoading, strategyDetails, setStreamingMessages]);

	// Add a function to restore a previous version
	const handleRestoreVersion = useCallback((versionIndex: number) => {
		const versionToRestore = state.history[versionIndex];
		if (!versionToRestore) return;

		setState(prev => ({
			...prev,
			stepResults: { ...versionToRestore.stepResults },
			completedSteps: [...versionToRestore.completedSteps],
			currentStep: versionToRestore.completedSteps.length
		}));

		toast.success(`Restored to version ${versionToRestore.version}`);
	}, [state.history]);

	// Add a function to handle adding child nodes
	const handleAddChildNode = useCallback((parentId: string) => {
		// Extract the step index from the parentId
		const stepIndex = parseInt(parentId.replace('step-', ''));
		if (isNaN(stepIndex) || stepIndex < 0 || stepIndex >= (strategyDetails?.steps?.length || 0)) {
			return;
		}

		// For now, show a toast message
		toast.info(`Adding a child node to step ${stepIndex + 1} (${strategyDetails?.steps[stepIndex]?.title}) will be implemented in a future update.`);

		// In the future, this would open a modal to select a child step to add
		// or create a new child step
	}, [strategyDetails]);

	return (
		<div className="flex flex-col h-full">
			{/* Settings Region with collapsible functionality */}
			<div className="border-b border-b-2 border-border/30 bg-muted/20">
				{/* Settings Header */}
				<div className="p-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Settings className="h-4 w-4 text-muted-foreground" />
						<h3 className="text-sm font-medium">Pipeline Settings</h3>
					</div>

					<div className="flex items-center gap-2">
						{/* Current step indicator when collapsed */}
						{!isSettingsExpanded && strategyDetails?.steps && (
							<div className="flex items-center">
								<span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
									Step {state.currentStep + 1}/{strategyDetails.steps.length}
								</span>
							</div>
						)}

						{/* Quick access generate button when collapsed */}
						{!isSettingsExpanded && (
							<Button
								onClick={handleGenerateDoc}
								disabled={isLoading || !strategyDetails}
								size="sm"
								variant="secondary"
								className="flex items-center gap-1"
							>
								{isLoading ? (
									<>
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										<span>Generating...</span>
									</>
								) : (
									<>
										<Play className="h-3.5 w-3.5" />
										<span>Generate</span>
									</>
								)}
							</Button>
						)}
						{/* Expand/collapse button */}
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={toggleSettings}
							title={isSettingsExpanded ? "Collapse settings" : "Expand settings"}
						>
							{isSettingsExpanded ? (
								<ChevronUp className="h-4 w-4" />
							) : (
								<ChevronDown className="h-4 w-4" />
							)}
						</Button>
					</div>
				</div>

				{/* Collapsible Settings Content with smooth transition */}
				<div
					className={cn(
						"overflow-hidden transition-all duration-300 ease-in-out",
						isSettingsExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
					)}
				>
					<div className="p-4 pt-0">
						{/* Strategy selector with improved heading */}
						<div className="mb-6">
							<h3 className="text-sm font-medium mb-2">Select Pipeline Strategy</h3>
							<StrategySelector
								value={selectedStrategy}
								onChange={handleStrategyChange}
								strategies={strategies || []}
							/>
						</div>

						{/* Progress and controls section with improved spacing */}
						{strategyDetails?.steps && strategyDetails.steps.length > 0 && (
							<div className="space-y-4">
								{/* Replace Progress bar with PipelineFlow */}
								<PipelineFlow
									steps={strategyDetails.steps}
									currentStep={state.currentStep}
									completedSteps={state.completedSteps}
									onStepClick={handleStepClick}
									onRestartFlow={handleRestartFlow}
									onAddChildNode={handleAddChildNode}
									results={state.stepResults}
									version={state.version}
									history={state.history}
									onRestoreVersion={handleRestoreVersion}
								/>

								{/* Control buttons with improved layout */}
								<div className="flex flex-col gap-3">
									<div className="flex justify-end">
										{/* Generation control buttons */}
										{isLoading && !isGenerationStopped && (
											<Button
												size="sm"
												variant="outline"
												onClick={handleStopGeneration}
												className="flex items-center gap-1"
												title="Stop generation"
											>
												<Square className="h-3.5 w-3.5" />
												<span>Stop</span>
											</Button>
										)}
										{isGenerationStopped && (
											<Button
												size="sm"
												variant="outline"
												onClick={handleContinueGeneration}
												className="flex items-center gap-1"
												title="Continue generation"
											>
												<Play className="h-3.5 w-3.5" />
												<span>Continue</span>
											</Button>
										)}
									</div>

									{/* Generate button with improved styling */}
									<Button
										onClick={handleGenerateDoc}
										disabled={isLoading || !strategyDetails}
										className="mx-auto px-8"
										size="default"
										variant="secondary"
									>
										{isLoading ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Generating...
											</>
										) : (
											<>
												<Play className="mr-2 h-4 w-4" />
												Generate
											</>
										)}
									</Button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			<div ref={containerRef} className="flex-1 overflow-y-auto p-4 pt-6 bg-background">
				{/* Show empty state when no messages are found for the selected pipeline */}
				{!isLoadingInitial && groupedMessages.length === 0 && !isLoading ? (
					<EmptyPipelineState
						pipelineName={selectedStrategy}
						onStart={() => handleStartPipeline()}
					/>
				) : (
					<>
						{/* Message groups */}
						{groupedMessages.map((group) => (
							<AgentMessageGroup
								key={`${group.step_index}-${group.iteration_index}`}
								group={group}
								currentStep={state.currentStep}
								onStepClick={handleStepClick}
							/>
						))}
						<div ref={endRef} />
					</>
				)}
			</div>
		</div>
	);
}