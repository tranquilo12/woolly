import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AgentMessage, MessageGroup } from '@/types/agent-messages';

interface SaveMessageParams {
	agentId: string;
	chatId: string;
	repository: string;
	messageType: 'documentation' | 'mermaid';
	role: string;
	content: string;
	toolInvocations?: any[];
}

export function useAgentMessages(chatId: string, agentId: string, repository: string, messageType: 'documentation' | 'mermaid') {
	const queryClient = useQueryClient();
	console.log("[DEBUG] useAgentMessages fetch called", {
		api: `/api/chat/${chatId}/agent/messages`,
		agentId,
		messageType,
		repository,
	});

	const { data, isError, isLoading, refetch } = useQuery({
		queryKey: ['messages', chatId, agentId, repository, messageType] as const,
		queryFn: async () => {
			const params = new URLSearchParams({
				agent_id: agentId,
				repository: repository,
				message_type: messageType
			});

			const response = await fetch(
				`/api/chat/${chatId}/agent/messages?${params.toString()}`
			);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to fetch messages: ${errorText}`);
			}

			const data = await response.json();
			return data || []; // Ensure we always return an array
		},
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});

	// Add debug logging for state changes
	useEffect(() => {
		console.log('Messages state changed:', {
			chatId,
			agentId,
			repository,
			messageType,
			hasData: !!data,
			isError,
			isLoading
		});
	}, [data, isError, isLoading, chatId, agentId, repository, messageType]);

	const groupMessages = (messages: AgentMessage[]): MessageGroup[] => {
		// Sort messages by step_index and created_at instead of iteration_index
		const sortedMessages = [...messages].sort((a, b) => {
			if (!a.step_index && !b.step_index) {
				return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
			}
			return (a.step_index ?? 0) - (b.step_index ?? 0);
		});

		console.log("[DEBUG] Sorted messages:", sortedMessages);

		return sortedMessages.reduce((groups: MessageGroup[], message, index) => {
			// Use index as group identifier if no step_index
			const stepIndex = message.step_index ?? index;

			let group = groups.find(g => g.step_index === stepIndex);
			if (!group) {
				group = {
					iteration_index: message.iteration_index ?? 0,
					messages: [],
					completed: false,
					step_index: stepIndex,
					step_title: message.step_title ?? `Step ${stepIndex + 1}`
				};
				groups.push(group);
			}

			// Check if this message completes the group
			if (message.tool_invocations?.some(tool =>
				tool.toolName === 'final_result' && tool.state === 'result'
			)) {
				group.completed = true;
			}

			group.messages.push(message);
			return groups;
		}, []);
	};

	const { mutate: saveMessage } = useMutation({
		mutationFn: async (params: SaveMessageParams & {
			iteration_index?: number;
			step_index?: number;
			step_title?: string;
		}) => {
			const messageData = {
				chat_id: params.chatId,
				agent_id: params.agentId,
				repository: params.repository,
				message_type: params.messageType,
				role: params.role,
				content: params.content,
				tool_invocations: params.toolInvocations,
				model: 'gpt-4o-mini', // Add default model since it's required by the backend
				iteration_index: params.iteration_index,
				step_index: params.step_index,
				step_title: params.step_title,
			};

			// Update to use the correct endpoint
			const response = await fetch(`/api/chat/${params.chatId}/agent/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(messageData)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to save message: ${errorText}`);
			}
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['messages', chatId, agentId, repository, messageType] as const });
		},
	});

	useEffect(() => {
		if (chatId && agentId && repository) {
			refetch();
		}
	}, [chatId, agentId, repository, refetch]);

	return {
		data,
		isError,
		isLoading,
		saveMessage,
		groupedMessages: data ? groupMessages(data) : [],
	};
} 