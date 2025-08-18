'use client';

import { useAgentMessages } from '@/hooks/use-agent-messages';
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { documentationApi, StrategyDetails } from '@/lib/api/documentation';
import { normalizeAgentData } from '@/lib/api/index';
import { AvailableRepository } from "@/lib/constants";
import { ToolInvocation } from '@ai-sdk/ui-utils';
import { useQuery } from '@tanstack/react-query';
import { Message } from "ai";
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Play, Loader2, Square, Settings, ChevronUp, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState, useMemo, useRef, ReactNode } from 'react';
import { DocumentationResult, isCodeDocumentation, isComponentAnalysis, isDevelopmentGuide, isMaintenanceOps, isSystemOverview } from '../../types/documentation';
import { MessageWithModel, toMessageWithModel } from "../chat";
import { Button } from "../ui/button";
import { StrategySelector } from './strategy-selector';
import { AgentMessageGroup } from './message-group';
import { PipelineFlow } from './pipeline-flow';
import 'reactflow/dist/style.css';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAgentPanel } from "./agent-provider";

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
	// Ensure agent_id is always a string
	const safeAgentId = agent_id ? String(agent_id) : '';
	const [localAgentId, setLocalAgentId] = useState<string>(safeAgentId);
	const { setDocAgentId } = useAgentPanel();
	const [containerRef, endRef, scrollToBottom] = useScrollToBottom<HTMLDivElement>();
	const [isLoading, setIsLoading] = useState(false);
	const [isStepComplete, setIsStepComplete] = useState(false);
	const [isGenerationStopped, setIsGenerationStopped] = useState(false);
	const [currentStepContent, setCurrentStepContent] = useState('');
	const [selectedStrategy, setSelectedStrategy] = useState('basic');
	const [isRunningSingleStep, setIsRunningSingleStep] = useState(false);
	const [singleStepIndex, setSingleStepIndex] = useState<number | null>(null);

	// Add a retry counter to prevent infinite loops
	const retryCountRef = useRef<number>(0);
	const currentStepRef = useRef<number>(-1);
	const maxRetries = 3; // Maximum number of retries per step
	const stepExecutionMap = useRef<Map<number, number>>(new Map()); // Track executions per step
	const lastExecutionTimeRef = useRef<number>(Date.now());
	const minExecutionInterval = 2000; // Minimum time between executions in ms

	// Add state for collapsible settings region
	const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
	const [streamingMessages, setStreamingMessages] = useState<Message[]>([]);

	// Toggle settings expansion
	const toggleSettings = useCallback(() => {
		setIsSettingsExpanded(prev => !prev);
	}, []);

	const {
		data: initialMessages = [],
		isError,
		isLoading: isLoadingInitial,
		saveMessage,
		groupedMessages
	} = useAgentMessages(
		chat_id,
		localAgentId,
		repo_name,
		'documentation',
		selectedStrategy // Pass the selected strategy as the pipeline_id
	);

	// Add useChat hook for message handling
	const {
		append,
		messages: chatMessages,
	} = useChat({
		transport: new DefaultChatTransport({
			api: '/api/chat',
			body: {
				agent_id: localAgentId,
				repo_name: repo_name,
				file_paths: file_paths,
				chat_id: chat_id,
				strategy: selectedStrategy,
				pipeline_id: selectedStrategy
			}
		}),
		id: chat_id,
		initialMessages: [],
	});

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

	const [isAgentReady, setIsAgentReady] = useState(!!localAgentId);

	// Add a ref to track if we've already initialized the agent
	const isInitializingRef = useRef(false);
	const hasInitializedRef = useRef(false);

	// Fetch strategy details
	const { data: strategyDetails, isLoading: isLoadingStrategy } = useQuery<StrategyDetails, Error>({
		queryKey: ['documentation', 'strategy', selectedStrategy],
		queryFn: () => documentationApi.getStrategyDetails(selectedStrategy),
		enabled: !!selectedStrategy,
	});

	// Use strategy steps instead of DOCUMENTATION_STEPS
	const currentStep = strategyDetails?.steps[state.currentStep];

	// Add a state to track the current loading step
	const [loadingStep, setLoadingStep] = useState<number | null>(null);

	// Add a ref to track if we're in the process of updating state
	const isUpdatingRef = useRef(false);

	// Add a ref to track if we're currently generating a step
	const isGeneratingStepRef = useRef(false);

	// Add a flag to track agent validation attempts
	const agentValidationAttemptsRef = useRef<number>(0);
	const maxAgentValidationAttempts = 3;
	const lastAgentValidationTimeRef = useRef<number>(0);
	const minAgentValidationInterval = 3000; // ms

	// Add state to track execution history
	const [executionHistory, setExecutionHistory] = useState<Array<{
		timestamp: number;
		step: number;
		status: 'started' | 'completed' | 'failed';
	}>>([]);

	// Add a function to track step execution
	const trackStepExecution = useCallback((step: number, status: 'started' | 'completed' | 'failed') => {
		setExecutionHistory(prev => [
			...prev,
			{
				timestamp: Date.now(),
				step,
				status
			}
		]);

		// Keep only the last 50 entries to avoid memory issues
		if (executionHistory.length > 50) {
			setExecutionHistory(prev => prev.slice(prev.length - 50));
		}

		// Log for debugging
		console.log(`DocumentationView: Step ${step} ${status} at ${new Date().toISOString()}`);
	}, [executionHistory]);

	// Add a function to check for execution loops
	const isInExecutionLoop = useCallback((step: number): boolean => {
		// Get the last 10 executions
		const recentExecutions = executionHistory.slice(-10);

		// Count how many times this step has been started in the recent history
		const stepStartCount = recentExecutions.filter(
			exec => exec.step === step && exec.status === 'started'
		).length;

		// If the same step has been started more than 3 times in the recent history,
		// we're probably in a loop
		if (stepStartCount >= 3) {
			console.error(`DocumentationView: Detected execution loop for step ${step} (started ${stepStartCount} times recently)`);
			return true;
		}

		return false;
	}, [executionHistory]);

	// Add a function to validate step execution
	const validateStepExecution = useCallback((stepIndex: number): boolean => {
		// Check if we're in an execution loop
		if (isInExecutionLoop(stepIndex)) {
			toast.error(`Detected execution loop for step ${stepIndex + 1}. Please try a different approach.`);
			return false;
		}

		// Check if we've exceeded the maximum number of retries for this step
		const executionCount = stepExecutionMap.current.get(stepIndex) || 0;
		if (executionCount >= maxRetries) {
			toast.error(`Maximum retries (${maxRetries}) exceeded for step ${stepIndex + 1}. Please try a different approach.`);
			return false;
		}

		// Check if we're trying to execute too quickly
		const now = Date.now();
		const timeSinceLastExecution = now - lastExecutionTimeRef.current;
		if (timeSinceLastExecution < minExecutionInterval) {
			toast.error(`Please wait a moment before trying again.`);
			return false;
		}

		// Update execution tracking
		stepExecutionMap.current.set(stepIndex, executionCount + 1);
		lastExecutionTimeRef.current = now;

		return true;
	}, [isInExecutionLoop, maxRetries, minExecutionInterval]);

	// Add a ref to track API call attempts
	const apiCallAttemptsRef = useRef<number>(0);
	const maxApiCallAttempts = 5;
	const lastApiCallTimeRef = useRef<number>(0);
	const minApiCallInterval = 1000; // ms

	// Add a utility function to handle API errors
	const handleApiError = useCallback(async (error: any, context: string) => {
		console.error(`DocumentationView: ${context}:`, error);

		// Extract more detailed error information
		let errorMessage = "An unexpected error occurred";

		if (error instanceof Error) {
			errorMessage = error.message;
			console.error(`Error details: ${error.stack}`);
		}

		// Handle Response objects
		if (error instanceof Response || (error as any)?.response) {
			const response = error instanceof Response ? error : (error as any).response;
			console.error(`Response status: ${response.status} ${response.statusText}`);

			try {
				// Try to get the response body for more details
				const text = await response.text();
				console.error(`Response body: ${text}`);

				// Try to parse as JSON for structured error messages
				try {
					const json = JSON.parse(text);
					if (json.detail) {
						errorMessage = json.detail;
					} else if (json.message) {
						errorMessage = json.message;
					}
				} catch (e) {
					// If it's not JSON, use the text as is
					if (text && text.length < 100) {
						errorMessage = text;
					}
				}
			} catch (e) {
				console.error("Failed to get response body:", e);
			}
		}

		// Show a toast with the error message
		toast.error(errorMessage);

		return errorMessage;
	}, []);

	// Add a ref to track if we're currently creating an agent
	const isCreatingAgentRef = useRef(false);

	// Enhance setupDocumentationAgent to include better error handling and loop prevention
	const setupDocumentationAgent = useCallback(async (): Promise<string | null> => {
		if (!repo_name) return null;

		// Prevent recursive calls
		if (isCreatingAgentRef.current) {
			console.log('DocumentationView: Already creating an agent, waiting...');
			// Wait for the current creation to finish
			let attempts = 0;
			while (isCreatingAgentRef.current && attempts < 10) {
				await new Promise(resolve => setTimeout(resolve, 500));
				attempts++;
			}

			// If we still have a valid agent ID after waiting, return it
			if (localAgentId && isAgentReady) {
				return localAgentId;
			}

			// If we've waited too long, return null
			if (attempts >= 10) {
				console.error('DocumentationView: Timed out waiting for agent creation');
				return null;
			}
		}

		// Set flag to indicate we're creating an agent
		isCreatingAgentRef.current = true;

		// Enforce minimum time between agent creation attempts
		const now = Date.now();
		const timeSinceLastValidation = now - lastAgentValidationTimeRef.current;
		if (timeSinceLastValidation < minAgentValidationInterval) {
			console.warn(`DocumentationView: Agent validation too frequent (${timeSinceLastValidation}ms), enforcing delay`);
			await new Promise(resolve => setTimeout(resolve, minAgentValidationInterval - timeSinceLastValidation));
		}
		lastAgentValidationTimeRef.current = now;

		let agentIdToUse = localAgentId;

		// If no localAgentId, generate a new one
		if (!agentIdToUse) {
			// Generate a new UUID for the agent
			const newAgentId = crypto.randomUUID();
			setLocalAgentId(newAgentId);
			setDocAgentId(newAgentId);
			localStorage.setItem(`doc_agent_${repo_name}`, newAgentId);
			agentIdToUse = newAgentId;
			// Continue with this new ID instead of returning early
		}

		// Don't proceed if agent is already ready and we're using the same ID
		if (isAgentReady && agentIdToUse === localAgentId) {
			isCreatingAgentRef.current = false;
			return agentIdToUse;
		}

		try {
			// First, create the agent using the /api/agents endpoint
			console.log('DocumentationView: Creating agent with ID:', agentIdToUse);
			const createAgentResponse = await fetch(`/api/agents`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: `documentation_agent_${repo_name}`,
					description: `Documentation agent for ${repo_name}`,
					system_prompt: "You are a documentation agent that helps generate documentation for code repositories.",
					tools: [],
					repository: repo_name
				}),
			});

			if (!createAgentResponse.ok) {
				throw new Error(`Failed to create agent: ${createAgentResponse.status} ${createAgentResponse.statusText}`);
			}

			// Get the agent ID from the response
			const agentData = await createAgentResponse.json();
			console.log('DocumentationView: Agent created successfully:', agentData);

			// Set the agent as ready
			setIsAgentReady(true);

			// Reset validation attempts on success
			agentValidationAttemptsRef.current = 0;

			// Return the agent ID
			isCreatingAgentRef.current = false;
			return agentIdToUse;
		} catch (error) {
			await handleApiError(error, "Error creating documentation agent");
			isCreatingAgentRef.current = false;
			return null;
		}
	}, [repo_name, localAgentId, isAgentReady, setDocAgentId, handleApiError, minAgentValidationInterval]);

	// Add a function to verify if an agent exists
	const verifyAgentExists = useCallback(async (agentId: string): Promise<string | null> => {
		if (!agentId) {
			console.error('DocumentationView: No agent ID provided to verifyAgentExists');
			return null;
		}

		// Enforce minimum time between validation attempts
		const now = Date.now();
		const timeSinceLastValidation = now - lastAgentValidationTimeRef.current;
		if (timeSinceLastValidation < minAgentValidationInterval) {
			console.warn(`DocumentationView: Agent validation too frequent (${timeSinceLastValidation}ms), enforcing delay`);
			await new Promise(resolve => setTimeout(resolve, minAgentValidationInterval - timeSinceLastValidation));
		}
		lastAgentValidationTimeRef.current = now;

		// Increment validation attempts
		agentValidationAttemptsRef.current += 1;

		// Check if we've exceeded the maximum number of validation attempts
		if (agentValidationAttemptsRef.current > maxAgentValidationAttempts) {
			console.error('DocumentationView: Exceeded maximum agent validation attempts');
			toast.error("Failed to validate agent after multiple attempts. Please try again later.");
			return null;
		}

		try {
			// First, check if we have a stored agent ID for this repo
			if (repo_name) {
				const storedAgentId = localStorage.getItem(`doc_agent_${repo_name}`);
				if (storedAgentId && storedAgentId !== agentId) {
					console.log('DocumentationView: Found stored agent ID:', storedAgentId);

					// Check if the stored agent exists
					try {
						const response = await fetch(`/api/agents/${storedAgentId}`, {
							method: 'GET',
							headers: {
								'Content-Type': 'application/json',
							},
						});

						if (response.ok) {
							// Get the agent data and normalize it
							const agentData = await response.json();
							const normalizedData = normalizeAgentData(agentData);

							if (normalizedData && normalizedData.id) {
								// Update our state with the valid stored ID
								setLocalAgentId(normalizedData.id);
								setDocAgentId(normalizedData.id);

								// Reset validation attempts on success
								agentValidationAttemptsRef.current = 0;

								return normalizedData.id;
							}
						}
					} catch (error) {
						await handleApiError(error, "Error checking stored agent");
					}
				}
			}

			// Check if the provided agent exists
			console.log('DocumentationView: Verifying agent exists:', agentId);
			try {
				const response = await fetch(`/api/agents/${agentId}`, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				});

				if (response.ok) {
					// Get the agent data and normalize it
					const agentData = await response.json();
					const normalizedData = normalizeAgentData(agentData);

					if (normalizedData && normalizedData.id) {
						console.log('DocumentationView: Agent exists:', normalizedData.id);

						// Reset validation attempts on success
						agentValidationAttemptsRef.current = 0;

						return normalizedData.id;
					}
				}
			} catch (error) {
				await handleApiError(error, "Error checking if agent exists");
			}

			// Return null if the agent doesn't exist or couldn't be normalized

			// If the agent doesn't exist, create a new one
			console.log('DocumentationView: Agent not found, creating a new one');
			toast.info("Agent not found. Creating a new one. Please wait...");

			// Set flag to indicate we're creating an agent
			isCreatingAgentRef.current = true;

			try {
				// Create a new agent and wait for the result
				const newAgentId = await setupDocumentationAgent();

				if (newAgentId) {
					console.log('DocumentationView: New agent created with ID:', newAgentId);

					// Reset validation attempts on success
					agentValidationAttemptsRef.current = 0;

					return newAgentId;
				} else {
					console.error('DocumentationView: Failed to create new agent');
					toast.error("Failed to create agent. Please try again.");
					return null;
				}
			} finally {
				// Always reset the flag
				isCreatingAgentRef.current = false;
			}
		} catch (error) {
			await handleApiError(error, "Error verifying agent");
			isCreatingAgentRef.current = false;
			return null;
		}
	}, [repo_name, setDocAgentId, setupDocumentationAgent, handleApiError, minAgentValidationInterval, maxAgentValidationAttempts]);

	// Add a function to handle response validation errors
	const handleResponseValidationError = useCallback((stepIndex: number, message: Message) => {
		console.error(`DocumentationView: Invalid response format for step ${stepIndex}`, message);

		// Show a toast with the error
		toast.error(`Invalid response format for step ${stepIndex + 1}. Please try again.`);

		// Reset loading states
		setIsLoading(false);
		setLoadingStep(null);

		// Reset single step execution state
		setIsRunningSingleStep(false);
		setSingleStepIndex(null);

		// Track the step execution as failed
		trackStepExecution(stepIndex, 'failed');

		// Add a special message to the state to indicate the error
		setState(prev => ({
			...prev,
			stepResults: {
				...prev.stepResults,
				[`step-${stepIndex}-error`]: {
					error: true,
					message: 'Invalid response format. Please try again.'
				}
			}
		}));
	}, [trackStepExecution]);

	// Enhance handleStepComplete to include loop prevention
	const handleStepComplete = useCallback(async (message?: Message) => {
		console.log('DocumentationView: handleStepComplete called');

		// Define isValidDocumentationResponse inside the callback to fix the linter error
		const isValidDocumentationResponse = (message: Message): boolean => {
			if (!message || !message.content) {
				console.error('DocumentationView: Invalid message format - missing content');
				return false;
			}

			// Check for tool invocations
			const toolInvocations = (message as any).tool_invocations || (message as any).toolInvocations;
			if (!toolInvocations || !Array.isArray(toolInvocations) || toolInvocations.length === 0) {
				console.error('DocumentationView: Invalid message format - missing or empty tool invocations');
				return false;
			}

			// Check for final_result tool invocation
			const finalResultTool = toolInvocations.find(
				(tool: any) => tool.toolName === 'final_result' && (tool.state === 'result' || tool.state === undefined)
			);

			if (!finalResultTool) {
				console.error('DocumentationView: Invalid message format - missing final_result tool invocation');
				return false;
			}

			// Check for valid content in the final_result tool
			if (!finalResultTool.output || typeof finalResultTool.output !== 'string') {
				console.error('DocumentationView: Invalid message format - missing or invalid output in final_result tool');
				return false;
			}

			// Try to parse the output as JSON
			try {
				const parsedOutput = JSON.parse(finalResultTool.output);

				// Check for required fields based on the strategy
				if (isSystemOverview(parsedOutput) ||
					isCodeDocumentation(parsedOutput) ||
					isComponentAnalysis(parsedOutput) ||
					isDevelopmentGuide(parsedOutput) ||
					isMaintenanceOps(parsedOutput)) {
					return true;
				} else {
					console.error('DocumentationView: Invalid message format - output does not match any known documentation type');
					return false;
				}
			} catch (error) {
				console.error('DocumentationView: Invalid message format - output is not valid JSON', error);
				return false;
			}
		};

		// Reset loading state
		setIsLoading(false);

		// Get current step from state
		const currentStep = state.currentStep;

		// If a message is provided, validate it
		if (message && !isValidDocumentationResponse(message)) {
			console.error('DocumentationView: Invalid response format for step', currentStep);
			handleResponseValidationError(currentStep, message);
			return;
		}

		// Track step completion
		trackStepExecution(currentStep, 'completed');

		// Check if we're executing the same step repeatedly
		if (currentStepRef.current === currentStep) {
			retryCountRef.current += 1;
			console.log(`DocumentationView: Retry count for step ${currentStep}: ${retryCountRef.current}`);

			// Update execution count in the map
			const currentExecutions = stepExecutionMap.current.get(currentStep) || 0;
			stepExecutionMap.current.set(currentStep, currentExecutions + 1);

			// Check if we've exceeded the retry limit
			if (retryCountRef.current >= maxRetries) {
				console.error(`DocumentationView: Exceeded retry limit (${maxRetries}) for step ${currentStep}`);
				toast.error(`Step ${currentStep + 1} failed after ${maxRetries} attempts. Please try a different approach.`);

				// Reset retry counter but don't proceed to next step
				retryCountRef.current = 0;
				return;
			}
		} else {
			// Reset retry counter for new step
			retryCountRef.current = 0;
			currentStepRef.current = currentStep;

			// Initialize execution count for this step
			stepExecutionMap.current.set(currentStep, 1);
		}

		// Check execution time to prevent rapid firing
		const now = Date.now();
		const timeSinceLastExecution = now - lastExecutionTimeRef.current;
		if (timeSinceLastExecution < minExecutionInterval) {
			console.warn(`DocumentationView: Execution too rapid (${timeSinceLastExecution}ms), enforcing delay`);
			await new Promise(resolve => setTimeout(resolve, minExecutionInterval - timeSinceLastExecution));
		}
		lastExecutionTimeRef.current = Date.now();

		// Reset single step execution state
		setIsRunningSingleStep(false);
		setSingleStepIndex(null);

		console.log('DocumentationView: handleStepComplete finished, reset loading states');
	}, [state.currentStep, trackStepExecution, handleResponseValidationError]);

	// Add a new function to run a single step
	const handleRunSingleStep = useCallback(async (stepIndex: number) => {
		console.log('DocumentationView: handleRunSingleStep called with stepIndex:', stepIndex);

		// Check if strategy details are loaded
		if (!strategyDetails) {
			console.error('DocumentationView: Cannot run step - strategy details not loaded');
			toast.error("Strategy details not loaded. Please wait or refresh the page.");
			return;
		}

		// Validate that the strategy has steps
		if (!strategyDetails.steps || strategyDetails.steps.length === 0) {
			console.error('DocumentationView: Cannot run step - strategy has no steps');
			toast.error("Selected strategy has no steps defined. Please select a different strategy.");
			return;
		}

		if (isLoading) {
			console.log('DocumentationView: Cannot run single step - already loading');
			toast.info("Already processing a step. Please wait.");
			return;
		}

		// Validate step execution to prevent loops
		if (!validateStepExecution(stepIndex)) {
			console.log('DocumentationView: Step execution validation failed, not running step');
			return;
		}

		// Track step execution start
		trackStepExecution(stepIndex, 'started');

		// Validate agent ID
		if (!localAgentId) {
			console.log('DocumentationView: Missing agent ID, creating a new one');
			toast.info("Creating a new agent for documentation. Please wait...");

			// Attempt to create a new agent and wait for it to complete
			const newAgentId = await setupDocumentationAgent();
			if (!newAgentId) {
				// If agent creation failed, show error and return
				toast.error("Failed to create agent. Please try again.");
				trackStepExecution(stepIndex, 'failed');
				return;
			}

			// Give a moment for the agent to be fully registered in the backend
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Now proceed with the new agent ID
			console.log('DocumentationView: Created new agent with ID:', newAgentId);
			return;
		}

		// Verify the agent exists before proceeding
		console.log('DocumentationView: Verifying agent exists before running single step');
		const validAgentId = await verifyAgentExists(localAgentId);
		if (!validAgentId) {
			// If verifyAgentExists returned null, it means there was an error
			// The function already shows a toast, so we just return
			trackStepExecution(stepIndex, 'failed');
			return;
		}

		// Use the valid agent ID (which might be different from localAgentId)
		if (validAgentId !== localAgentId) {
			console.log('DocumentationView: Using different agent ID than local for single step:', validAgentId);
			setLocalAgentId(validAgentId);
			setDocAgentId(validAgentId);

			// Give a moment for the agent ID to be updated in state
			await new Promise(resolve => setTimeout(resolve, 500));
		}

		// Set global loading state
		setIsLoading(true);
		console.log('DocumentationView: Starting single step with agent ID:', validAgentId);

		// Set the selected step as the loading step
		setLoadingStep(stepIndex);

		// Make sure the step index is valid
		if (stepIndex < 0 || stepIndex >= strategyDetails.steps.length) {
			console.log('DocumentationView: Invalid step index:', stepIndex);
			setIsLoading(false);
			setLoadingStep(null);
			return;
		}

		// Set the single step execution state
		setIsRunningSingleStep(true);
		setSingleStepIndex(stepIndex);

		const stepToRun = strategyDetails.steps[stepIndex];
		setCurrentStepContent('');
		setIsStepComplete(false);

		// Clear any previous streaming messages to avoid conflicts
		setStreamingMessages([]);

		// Update state to indicate we're running a single step
		setState(prev => {
			// Make sure we're setting the current step to the one we're running
			return {
				...prev,
				currentStep: stepIndex, // Ensure currentStep is set to the step we're running
				context: {
					...prev.context,
					single_step: 'true',
					run_single_step: 'true',
					only_step: String(stepIndex), // Add the specific step index to run
					skip_subsequent_steps: 'true', // Explicitly tell the backend to skip subsequent steps
					currentPrompt: stepToRun.prompt // Set the current prompt to the step's prompt
				}
			};
		});

		console.log('DocumentationView: Updated state for single step execution, about to call append');

		try {
			// Create a custom message that explicitly indicates this is a single step run
			const customMessage = `Run only step ${stepIndex + 1}: ${stepToRun.title}`;

			// Get the system prompt from the step if available, or use a default
			const systemPrompt = stepToRun.system_prompt ||
				`You are a documentation assistant helping to analyze code components. You are currently working on step ${stepIndex + 1}: ${stepToRun.title}.`;

			// Create a properly initialized messages array
			const initializedMessages = [
				// System message
				{
					id: crypto.randomUUID(),
					role: 'system',
					content: systemPrompt,
					createdAt: new Date().toISOString()
				},
				// User message with the prompt from the strategy
				{
					id: crypto.randomUUID(),
					role: 'user',
					content: stepToRun.prompt,
					createdAt: new Date().toISOString()
				}
			];

			// Combine with any existing messages, but ensure our initialized messages come first
			const combinedMessages = [...initializedMessages];

			// Only add existing messages if they exist and aren't duplicates
			if (initialMessages && initialMessages.length > 0) {
				// Filter out any system messages to avoid conflicts
				const nonSystemMessages = initialMessages.filter((msg: Message) => msg.role !== 'system');
				// Type safety: Only add messages that have the required properties
				nonSystemMessages.forEach((msg: Message) => {
					if (msg.id && msg.role && msg.content) {
						combinedMessages.push(msg as any);
					}
				});
			}

			if (streamingMessages && streamingMessages.length > 0) {
				// Type safety: Only add messages that have the required properties
				streamingMessages.forEach((msg: Message) => {
					if (msg.id && msg.role && msg.content) {
						combinedMessages.push(msg as any);
					}
				});
			}

			// Log the request body for debugging
			const requestBody = {
				id: chat_id,
				messages: combinedMessages,
				model: "gpt-4o-mini",
				agent_id: validAgentId, // Use the validated agent ID
				repo_name: repo_name,
				file_paths: file_paths,
				chat_id: chat_id,
				step: stepIndex + 1,
				context: {
					...state.context,
					current_step: stepIndex,
					currentPrompt: stepToRun.prompt,
					single_step: 'true',
					run_single_step: 'true',
					only_step: String(stepIndex),
					skip_subsequent_steps: 'true',
					original_prompt: stepToRun.prompt,
					system_prompt: systemPrompt // Add system prompt to context
				},
				prompt: customMessage,
				original_prompt: stepToRun.prompt,
				strategy: selectedStrategy,
				pipeline_id: selectedStrategy,
				single_step: 'true',
				run_single_step: true,
				only_step: stepIndex,
				skip_subsequent_steps: true
			};

			// Double-check that messages array is never empty (defensive programming)
			if (!requestBody.messages || requestBody.messages.length === 0) {
				console.error('DocumentationView: Messages array is still empty after initialization, adding fallback messages');
				requestBody.messages = initializedMessages;
			}

			console.log('DocumentationView: Request body for append:', requestBody);
			console.log('DocumentationView: Messages count:', requestBody.messages.length);

			await append({
				role: 'user',
				content: customMessage
			}, {
				body: requestBody
			});

			console.log('DocumentationView: Successfully called append for single step execution');
		} catch (error) {
			console.error('DocumentationView: Error running single step:', error);

			// Provide more detailed error information
			let errorMessage = "Failed to run step. Please try again.";

			// Check for specific error types
			if (error instanceof Error) {
				console.error('Error details:', error.stack);

				// Check for specific error messages
				if (error.message.includes('messages')) {
					errorMessage = "Error with messages format. Please try again or refresh the page.";
				} else if (error.message.includes('agent')) {
					errorMessage = "Error with agent configuration. Please try again or create a new agent.";
				} else if (error.message.includes('network') || error.message.includes('fetch')) {
					errorMessage = "Network error. Please check your connection and try again.";
				} else {
					// Use the actual error message if it's not too long
					if (error.message.length < 100) {
						errorMessage = error.message;
					}
				}
			}

			// Reset loading states
			setIsLoading(false);
			setLoadingStep(null);

			// Reset the single step execution state after a delay
			setTimeout(() => {
				setIsRunningSingleStep(false);
				setSingleStepIndex(null);
			}, 1000);

			// Show error toast with the more detailed message
			toast.error(errorMessage);

			// Track the step execution as failed
			trackStepExecution(stepIndex, 'failed');
		}

		// Reset the isGenerationStopped state
		setIsGenerationStopped(false);
	}, [
		isLoading,
		strategyDetails,
		validateStepExecution,
		trackStepExecution,
		localAgentId,
		verifyAgentExists,
		setupDocumentationAgent,
		setDocAgentId,
		chat_id,
		initialMessages,
		streamingMessages,
		repo_name,
		file_paths,
		state.context,
		selectedStrategy,
		append
	]);

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
		// Don't do anything if the strategy hasn't changed
		if (newStrategy === selectedStrategy) return;

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

		// Make sure we don't automatically trigger generation
		setIsStepComplete(false);
	};

	// Add a useEffect to ensure the agent is created when the component mounts
	useEffect(() => {
		// Prevent multiple initializations
		if (isInitializingRef.current || hasInitializedRef.current) return;

		const initializeAgent = async () => {
			if (!repo_name) return;

			// Set flag to prevent concurrent initializations
			isInitializingRef.current = true;

			try {
				// Check if we have a stored agent ID
				const storedAgentId = localStorage.getItem(`doc_agent_${repo_name}`);

				if (storedAgentId) {
					// Verify the stored agent exists
					console.log('DocumentationView: Found stored agent ID, verifying it exists:', storedAgentId);
					try {
						const response = await fetch(`/api/agents/${storedAgentId}`, {
							method: 'GET',
							headers: {
								'Content-Type': 'application/json',
							},
						});

						if (response.ok) {
							console.log('DocumentationView: Stored agent exists, using it:', storedAgentId);
							setLocalAgentId(storedAgentId);
							setDocAgentId(storedAgentId);
							setIsAgentReady(true);
							hasInitializedRef.current = true;
							isInitializingRef.current = false;
							return;
						} else {
							console.log('DocumentationView: Stored agent does not exist, creating a new one');
							// If the stored agent doesn't exist, remove it from localStorage
							localStorage.removeItem(`doc_agent_${repo_name}`);
						}
					} catch (error) {
						console.error('DocumentationView: Error verifying stored agent:', error);
					}
				}

				// If we don't have a valid stored agent ID or the agent doesn't exist, create a new one
				if (!localAgentId) {
					console.log('DocumentationView: No valid agent ID, creating a new one');
					await setupDocumentationAgent();
				}

				// Mark as initialized regardless of outcome to prevent loops
				hasInitializedRef.current = true;
			} finally {
				// Always reset the initializing flag
				isInitializingRef.current = false;
			}
		};

		initializeAgent();
	}, [localAgentId, repo_name, setDocAgentId, setupDocumentationAgent]);

	// Add handler for restoring version
	const handleRestoreVersion = useCallback((version: number) => {
		// Logic for restoring version
		console.log('Restoring to version:', version);
	}, []);

	// Add handler for generating documentation
	const handleGenerateDoc = useCallback(async () => {
		if (isLoading) return;

		// Validate agent ID
		if (!localAgentId) {
			console.log('DocumentationView: Missing agent ID, creating a new one');
			toast.info("Creating a new agent for documentation. Please wait...");

			// Attempt to create a new agent and wait for it to complete
			const newAgentId = await setupDocumentationAgent();
			if (!newAgentId) {
				// If agent creation failed, show error and return
				toast.error("Failed to create agent. Please try again.");
				return;
			}
		}

		// Set loading state
		setIsLoading(true);
		setLoadingStep(0);
		setIsGenerationStopped(false);

		// Reset state to start from the beginning
		setState(prev => ({
			...prev,
			currentStep: 0,
			completedSteps: [],
			context: {
				...prev.context,
				currentPrompt: strategyDetails?.steps[0]?.prompt || ''
			}
		}));

		// Start the documentation generation process
		try {
			await append({
				role: 'user',
				content: 'Generate documentation'
			}, {
				body: {
					id: chat_id,
					messages: [...initialMessages, ...streamingMessages],
					model: "gpt-4o-mini",
					agent_id: localAgentId,
					repo_name: repo_name,
					file_paths: file_paths,
					chat_id: chat_id,
					strategy: selectedStrategy,
					pipeline_id: selectedStrategy
				}
			});
		} catch (error) {
			console.error('DocumentationView: Error generating documentation:', error);
			setIsLoading(false);
			setLoadingStep(null);
			toast.error("Failed to generate documentation. Please try again.");
		}
	}, [isLoading, localAgentId, setupDocumentationAgent, setLoadingStep, strategyDetails, append, chat_id, initialMessages, streamingMessages, repo_name, file_paths, selectedStrategy]);

	// Add handler for starting pipeline
	const handleStartPipeline = useCallback(() => {
		handleGenerateDoc();
	}, [handleGenerateDoc]);

	// Add a ref to track previous groupedMessages
	const prevGroupedMessagesRef = useRef<typeof groupedMessages>([]);

	// Add an effect to update completedSteps based on groupedMessages
	useEffect(() => {
		// Skip if no messages or if groupedMessages hasn't changed
		if (!groupedMessages.length || groupedMessages === prevGroupedMessagesRef.current) return;

		// Update the ref
		prevGroupedMessagesRef.current = groupedMessages;

		// Extract unique step indices from groupedMessages, ensuring they are valid numbers
		const completedStepIndices = Array.from(new Set(
			groupedMessages
				.filter(group => group.messages && group.messages.length > 0 && typeof group.step_index === 'number')
				.map(group => group.step_index as number)
		));

		// Only update if the arrays are different (without modifying them)
		const areArraysEqual = (a: number[], b: number[]) => {
			if (a.length !== b.length) return false;
			const sortedA = [...a].sort((x, y) => x - y);
			const sortedB = [...b].sort((x, y) => x - y);
			return sortedA.every((val, idx) => val === sortedB[idx]);
		};

		if (!areArraysEqual(state.completedSteps, completedStepIndices)) {
			console.log('DocumentationView: Updating completedSteps in state:', completedStepIndices);
			setState(prev => ({
				...prev,
				completedSteps: completedStepIndices
			}));
		}
	}, [groupedMessages, state.completedSteps]); // Only depend on groupedMessages

	// Add refs for message groups to enable scrolling to them
	const messageRefs = useRef<Map<number, HTMLElement | null>>(new Map());

	// Add a function to register message refs
	const registerMessageRef = useCallback((stepIndex: number, ref: HTMLElement | null) => {
		if (ref) {
			messageRefs.current.set(stepIndex, ref);
		}
	}, []);

	// Add a function to scroll to a message
	const scrollToMessage = useCallback((stepIndex: number) => {
		const ref = messageRefs.current.get(stepIndex);
		if (ref) {
			ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}, []);

	// Add handler for step click
	const handleStepClick = useCallback((stepIndex: number) => {
		if (isLoading) return;
		handleRunSingleStep(stepIndex);
	}, [isLoading, handleRunSingleStep]);

	// Add handler for stopping generation
	const handleStopGeneration = useCallback(() => {
		setIsGenerationStopped(true);
		// Additional logic to stop generation if needed
	}, []);

	// Add handler for continuing generation
	const handleContinueGeneration = useCallback(() => {
		setIsGenerationStopped(false);
		// Additional logic to continue generation if needed
	}, []);

	// Add handler for adding child node
	const handleAddChildNode = useCallback((parentId: string) => {
		// Logic for adding child node
		console.log('Adding child node to parent:', parentId);
	}, []);

	return (
		<div className="flex flex-col h-full overflow-hidden">
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
								{(() => { console.log('DocumentationView: Rendering PipelineFlow with completedSteps:', state.completedSteps); return null; })()}
								<PipelineFlow
									steps={strategyDetails.steps}
									currentStep={state.currentStep}
									completedSteps={state.completedSteps}
									onStepClick={handleStepClick}
									onRestartFlow={handleGenerateDoc}
									onAddChildNode={handleAddChildNode}
									results={state.stepResults}
									version={state.version}
									history={state.history}
									onRestoreVersion={handleRestoreVersion}
									isLoading={isLoading}
									loadingStep={loadingStep !== null ? loadingStep : undefined}
									scrollToMessage={scrollToMessage}
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
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Add a minimal visual indicator for single step execution */}
			{isRunningSingleStep && singleStepIndex !== null && strategyDetails && (
				<div className="text-xs text-muted-foreground mb-2 text-right">
					Running: {strategyDetails.steps[singleStepIndex].title}
				</div>
			)}

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
								isLoading={isLoading && (loadingStep === group.step_index)}
								ref={(ref) => {
									if (group.step_index !== undefined) {
										registerMessageRef(group.step_index, ref);
									}
								}}
							/>
						))}
						<div ref={endRef} />
					</>
				)}
			</div>
		</div>
	);
}