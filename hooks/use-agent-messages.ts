import { useQuery } from '@tanstack/react-query';

interface AgentMessage {
	id: string;
	content: string;
	role: string;
	created_at: string;
	agent_id: string;
}

export function useAgentMessages(chatId: string, agentId: string) {
	return useQuery({
		queryKey: ['agent-messages', chatId, agentId],
		queryFn: async () => {
			const response = await fetch(`/api/chat/${chatId}/agent/${agentId}/messages`);
			if (!response.ok) throw new Error('Failed to fetch agent messages');
			const messages: AgentMessage[] = await response.json();

			return messages.map(msg => ({
				id: msg.id,
				content: msg.content,
				role: msg.role as "system" | "user" | "assistant" | "data",
				createdAt: new Date(msg.created_at)
			}));
		},
		staleTime: 30000, // Consider data fresh for 30 seconds
	});
} 