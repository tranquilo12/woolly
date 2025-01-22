import { Message, useChat } from 'ai/react';
import { useState, useCallback } from 'react';
import { MessageWithModel } from '@/components/chat';
import { toast } from 'sonner';
import { ExtendedToolCall } from '@/types/tool-calls';

interface UseParameterizedChatProps {
	endpoint: string;
	chatId?: string;
	initialMessages?: MessageWithModel[];
	body?: Record<string, any>;
	model?: string;
}

export function useParameterizedChat({
	endpoint,
	chatId,
	model,
	initialMessages = [],
	body = {},
}: UseParameterizedChatProps) {
	const [isThinking, setIsThinking] = useState(false);

	const getMostCompleteToolInvocation = useCallback((toolInvocations: ExtendedToolCall[]) => {
		return toolInvocations.find(
			tool => tool.args && tool.result
		) || toolInvocations[0];
	}, []);

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
			}
		},
		onToolCall: async (tool) => {
			chat.setMessages((prevMessages: Message[]) => {
				const lastMessage = prevMessages[prevMessages.length - 1];
				if (!lastMessage) return prevMessages;

				const updatedToolInvocations = lastMessage.toolInvocations || [];
				const existingToolIndex = updatedToolInvocations.findIndex(t => t.toolCallId === tool.toolCall.toolCallId);


				if (existingToolIndex >= 0) {
					updatedToolInvocations[existingToolIndex] = {
						...updatedToolInvocations[existingToolIndex],
						toolCallId: tool.toolCall.toolCallId,
						toolName: tool.toolCall.toolName,
						args: tool.toolCall.args,
					};
				} else {
					updatedToolInvocations.push({
						toolCallId: tool.toolCall.toolCallId,
						toolName: tool.toolCall.toolName,
						args: tool.toolCall.args,
						// @ts-ignore Property 'state' does not exist on type 'ToolCall<string, unknown>'
						state: tool.toolCall.state || 'partial-call'
					});
				}

				return prevMessages.map((msg, i) =>
					i === prevMessages.length - 1
						? { ...msg, toolInvocations: updatedToolInvocations }
						: msg
				);
			});
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