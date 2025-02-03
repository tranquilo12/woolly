import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SaveMessageParams {
	agentId: string;
	chatId: string;
	repository: string;
	messageType: 'documentation' | 'mermaid';
	role: string;
	content: string;
}

export function useAgentMessages(chatId: string, agentId: string, repository: string, messageType: 'documentation' | 'mermaid') {
	const queryClient = useQueryClient();

	const { data, isError, isLoading } = useQuery({
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
			const response = await fetch(`/api/agents/${params.agentId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(params),
			});
			if (!response.ok) throw new Error('Failed to save message');
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['messages', chatId, agentId, repository, messageType] as const });
		},
	});

	return {
		data,
		isError,
		isLoading,
		saveMessage,
	};
} 