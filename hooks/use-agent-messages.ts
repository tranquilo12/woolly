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
			const response = await fetch(
				`/api/agents/${agentId}/messages?chat_id=${chatId}&repository=${repository}&message_type=${messageType}`
			);
			if (!response.ok) throw new Error('Failed to fetch messages');
			return response.json();
		},
		enabled: !!chatId && !!agentId && !!repository,
	});

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