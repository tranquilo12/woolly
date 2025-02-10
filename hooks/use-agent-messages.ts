import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

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

	const { data, isError, isLoading, refetch } = useQuery({
		queryKey: ['messages', chatId, agentId, repository, messageType],
		queryFn: async () => {
			console.log('Fetching messages with params:', {
				chatId,
				agentId,
				repository,
				messageType
			});

			const response = await fetch(
				`/api/agents/${agentId}/messages?chat_id=${chatId}&repository=${repository}&message_type=${messageType}`
			);

			if (!response.ok) {
				const error = await response.text();
				console.error('Failed to fetch messages:', error);
				throw new Error(`Failed to fetch messages: ${error}`);
			}

			const data = await response.json();
			console.log('Fetched messages:', data);
			return data;
		},
		enabled: !!chatId && !!agentId && !!repository && !!messageType,
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

	const { mutate: saveMessage } = useMutation({
		mutationFn: async (params: SaveMessageParams) => {
			const messageData = {
				chat_id: params.chatId,
				agent_id: params.agentId,
				repository: params.repository,
				message_type: params.messageType,
				role: params.role,
				content: params.content,
				tool_invocations: params.toolInvocations
			};

			const response = await fetch(`/api/agents/${params.agentId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(messageData)
			});
			if (!response.ok) throw new Error('Failed to save message');
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
	};
} 