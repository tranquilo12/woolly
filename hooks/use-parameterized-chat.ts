import { Message, useChat } from 'ai/react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { MessageWithModel } from '@/components/chat';
import { toast } from 'sonner';
import { ExtendedToolCall } from '@/types/tool-calls';

interface UseParameterizedChatProps {
	endpoint: string;
	chatId?: string;
	initialMessages?: MessageWithModel[];
	body?: Record<string, any>;
	model?: string;
	maxSteps?: number;
	maxRetries?: number;
	headers?: Record<string, string>;
}

export function useParameterizedChat({
	endpoint,
	chatId,
	model,
	initialMessages = [],
	body = {},
	maxRetries = 2,
	headers = {}
}: UseParameterizedChatProps) {
	const [isThinking, setIsThinking] = useState(false);
	const [failedTools, setFailedTools] = useState<Map<string, { count: number; error: Error }>>(new Map());
	const [processingTools, setProcessingTools] = useState<Set<string>>(new Set());

	// Add cache size limit and cleanup
	const MAX_CACHE_SIZE = 100;
	const toolInvocationCache = useMemo(() => {
		const cache = new Map<string, ExtendedToolCall>();
		const cleanup = () => {
			if (cache.size > MAX_CACHE_SIZE) {
				const entriesToDelete = Array.from(cache.keys())
					.slice(0, cache.size - MAX_CACHE_SIZE);
				entriesToDelete.forEach(key => cache.delete(key));
			}
		};
		return {
			get: (key: string) => cache.get(key),
			set: (key: string, value: ExtendedToolCall) => {
				cache.set(key, value);
				cleanup();
			},
			has: (key: string) => cache.has(key),
			clear: () => cache.clear()
		};
	}, []);

	// Cleanup cache on unmount
	useEffect(() => {
		return () => {
			toolInvocationCache.clear();
		};
	}, [toolInvocationCache]);

	const getMostCompleteToolInvocation = useCallback((toolInvocations: ExtendedToolCall[]) => {
		// Skip failed tools
		const validTools = toolInvocations.filter(tool => !failedTools.has(tool.toolCallId));

		// First check cache for any completed invocations
		const cachedComplete = validTools.find(tool =>
			toolInvocationCache.has(tool.toolCallId) &&
			toolInvocationCache.get(tool.toolCallId)?.result
		);
		if (cachedComplete) return cachedComplete;

		// Fallback to finding first complete tool or first tool
		return validTools.find(
			tool => tool.args && tool.result
		) || validTools[0];
	}, [toolInvocationCache, failedTools]);

	const handleToolError = useCallback((toolId: string, error: Error) => {
		setFailedTools(prev => {
			const newMap = new Map(prev);
			const current = newMap.get(toolId);
			if (current && current.count >= maxRetries) {
				toast.error(`Tool execution failed after ${maxRetries} attempts`);
			} else {
				newMap.set(toolId, {
					count: (current?.count || 0) + 1,
					error
				});
			}
			return newMap;
		});
	}, [maxRetries]);

	const retryFailedTool = useCallback(async (toolId: string) => {
		const failedTool = failedTools.get(toolId);
		if (!failedTool || failedTool.count >= maxRetries) return false;

		setProcessingTools(prev => new Set(prev).add(toolId));
		try {
			// Existing tool retry logic here
			setFailedTools(prev => {
				const newMap = new Map(prev);
				newMap.delete(toolId);
				return newMap;
			});
			return true;
		} catch (error) {
			handleToolError(toolId, error as Error);
			return false;
		} finally {
			setProcessingTools(prev => {
				const newSet = new Set(prev);
				newSet.delete(toolId);
				return newSet;
			});
		}
	}, [failedTools, maxRetries, handleToolError]);

	// Add this before the chat initialization
	const defaultHeaders = useMemo(() => ({
		'Accept': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	}), []);

	const chat = useChat({
		api: endpoint,
		id: chatId,
		initialMessages,
		body: {
			id: chatId,
			model,
			...body
		},
		onResponse: async (response) => {
			if (response.ok) {
				if (response.headers.get('x-vercel-ai-data-stream') === 'v1') {
					setIsThinking(true);
				}
				else {
					console.error('Unexpected response format:', response.headers.get('content-type'));
				}
			} else {
				console.error('Response not OK:', response.status, response.statusText);
				toast.error('Failed to process request');
			}
		},
		onFinish: async (message, options) => {
			try {
				const messageWithModel = {
					...message,
					model,
					prompt_tokens: options.usage?.promptTokens,
					completion_tokens: options.usage?.completionTokens,
					total_tokens: options.usage?.totalTokens,
					toolInvocations: message.toolInvocations?.map(tool => ({
						...tool,
						state: tool.state || 'result'
					}))
				} as MessageWithModel;

				chat.setMessages((prevMessages: Message[]) =>
					prevMessages.map((m: Message) =>
						m.id === messageWithModel.id ? messageWithModel : m
					)
				);

				setIsThinking(false);
			} catch (error) {
				console.error('Failed to update message state:', error);
				toast.error('Failed to process message');
			}
		},
		onToolCall: async (tool) => {
			console.log('Tool call:', tool);

			const toolId = tool.toolCall.toolCallId;
			setProcessingTools(prev => new Set(prev).add(toolId));

			try {
				chat.setMessages((prevMessages: Message[]) => {
					const lastMessage = prevMessages[prevMessages.length - 1];
					if (!lastMessage) return prevMessages;

					const updatedToolInvocations = lastMessage.toolInvocations || [];
					const existingToolIndex = updatedToolInvocations.findIndex(t =>
						t.toolCallId === toolId
					);

					const updatedTool = {
						toolCallId: toolId,
						toolName: tool.toolCall.toolName,
						args: tool.toolCall.args,
						// @ts-ignore Property 'state' does not exist on type 'ToolCall<string, unknown>'
						state: tool.toolCall.state || 'partial-call'
					};

					toolInvocationCache.set(toolId, updatedTool);

					if (existingToolIndex >= 0) {
						updatedToolInvocations[existingToolIndex] = {
							...updatedToolInvocations[existingToolIndex],
							...updatedTool
						};
					} else {
						updatedToolInvocations.push(updatedTool);
					}

					return prevMessages.map((msg, i) =>
						i === prevMessages.length - 1
							? { ...msg, toolInvocations: updatedToolInvocations }
							: msg
					);
				});
			} catch (error) {
				handleToolError(toolId, error as Error);
				console.error('Tool invocation error:', error);
				toast.error('Failed to process tool invocation');
			} finally {
				setProcessingTools(prev => {
					const newSet = new Set(prev);
					newSet.delete(toolId);
					return newSet;
				});
			}
		},
		onError: (error) => {
			console.error('Chat error:', error);
			toast.error('An error occurred during the chat');
			setIsThinking(false);
		},
		headers: {
			...defaultHeaders,
			...headers
		}
	});

	return {
		...chat,
		isThinking,
		setIsThinking,
		failedTools,
		processingTools,
		retryFailedTool,
		input: chat.input,
		setInput: chat.setInput,
		setMessages: chat.setMessages,
		getMostCompleteToolInvocation,
		handleInputChange: chat.handleInputChange,
		handleSubmit: chat.handleSubmit,
		append: chat.append,
		stop: chat.stop,
		isLoading: chat.isLoading
	};
} 