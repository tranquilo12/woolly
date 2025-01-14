import { useState, useCallback } from 'react';
import { useChat } from 'ai/react';

interface UseDocumentationAgentProps {
	chatId: string;
}

export function useDocumentationAgent({ chatId }: UseDocumentationAgentProps) {
	const [agentId, setAgentId] = useState<string | null>(null);
	const [isStreaming, setIsStreaming] = useState(false);
	const [streamedContent, setStreamedContent] = useState<string>('');

	const { messages, append, setMessages } = useChat({
		api: `/api/agents/${agentId}/documentation`,
		id: chatId,
		body: {
			agent_id: agentId,
		},
		onFinish: () => {
			setIsStreaming(false);
		},
		onResponse: (response) => {
			if (response.headers.get('x-vercel-ai-data-stream') === 'v1') {
				setIsStreaming(true);
			}
		},

	});

	const initializeAgent = useCallback(async () => {
		if (agentId) return agentId;

		try {
			const response = await fetch('/api/agents', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: 'Documentation Generator',
					description: 'Generates documentation for repositories',
					system_prompt: 'You are a documentation assistant.',
				}),
			});

			if (!response.ok) throw new Error('Failed to create agent');
			const agent = await response.json();
			setAgentId(agent.id);
			return agent.id;
		} catch (error) {
			console.error('Failed to initialize agent:', error);
			throw error;
		}
	}, [agentId]);

	return {
		agentId,
		messages,
		append,
		setMessages,
		initializeAgent,
		isStreaming,
		streamedContent
	};
} 