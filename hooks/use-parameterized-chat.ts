import { Message, useChat } from 'ai/react';
import { useState, useCallback, useMemo } from 'react';
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
}

export function useParameterizedChat({
	endpoint,
	chatId,
	model,
	initialMessages = [],
	body = {},
	maxSteps = 5,
}: UseParameterizedChatProps) {
	const [isThinking, setIsThinking] = useState(false);
	const toolInvocationCache = useMemo(() => new Map<string, ExtendedToolCall>(), []);

	const getMostCompleteToolInvocation = useCallback((toolInvocations: ExtendedToolCall[]) => {
		// First check cache for any completed invocations
		const cachedComplete = toolInvocations.find(tool =>
			toolInvocationCache.has(tool.toolCallId) &&
			toolInvocationCache.get(tool.toolCallId)?.result
		);
		if (cachedComplete) return cachedComplete;

		// Fallback to finding first complete tool or first tool
		return toolInvocations.find(
			tool => tool.args && tool.result
		) || toolInvocations[0];
	}, [toolInvocationCache]);

	const chat = useChat({
		api: endpoint,
		id: chatId,
		initialMessages,
		maxSteps,
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
			} else {
				toast.error('Failed to process tool invocation');
			}
		},
		onToolCall: async (tool) => {
			try {
				chat.setMessages((prevMessages: Message[]) => {
					const lastMessage = prevMessages[prevMessages.length - 1];
					if (!lastMessage) return prevMessages;

					const updatedToolInvocations = lastMessage.toolInvocations || [];
					const existingToolIndex = updatedToolInvocations.findIndex(t =>
						t.toolCallId === tool.toolCall.toolCallId
					);

					const updatedTool = {
						toolCallId: tool.toolCall.toolCallId,
						toolName: tool.toolCall.toolName,
						args: tool.toolCall.args,
						// @ts-ignore Property 'state' does not exist on type 'ToolCall<string, unknown>'
						state: tool.toolCall.state || 'partial-call'
					};

					// Update cache
					toolInvocationCache.set(updatedTool.toolCallId, updatedTool);

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
				console.error('Tool invocation error:', error);
				toast.error('Failed to process tool invocation');
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
		onError: (error) => {
			console.error('Chat error:', error);
			toast.error('An error occurred during the chat');
			setIsThinking(false);
		},
	});

	return {
		...chat,
		isThinking,
		setIsThinking,
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