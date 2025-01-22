import { useState, useCallback } from 'react';
import { useParameterizedChat } from './use-parameterized-chat';

interface UseDocumentationAgentProps {
	chatId: string;
}

export function useDocumentationAgent({ chatId }: UseDocumentationAgentProps) {
	const [agentId, setAgentId] = useState<string | null>(null);
	const [agentError, setAgentError] = useState<string | null>(null);

	const {
		messages,
		append,
		setMessages,
		isThinking,
		setIsThinking,
		getMostCompleteToolInvocation,
		handleSubmit,
		stop,
		isLoading
	} = useParameterizedChat({
		endpoint: `/api/agents/${agentId}/documentation`,
		chatId,
		body: {
			agent_id: agentId,
		}
	});

	const initializeAgent = useCallback(async () => {
		if (agentId) return agentId;

		setAgentError(null);
		try {
			const response = await fetch('/api/agents', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: 'Documentation Generator',
					description: 'Generates documentation for repositories',
					system_prompt: 'You are a documentation assistant. Generate comprehensive documentation for the provided repository and files. Focus on code structure, architecture, and key functionalities.',
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.detail || 'Failed to create agent');
			}

			const agent = await response.json();
			setAgentId(agent.id);
			return agent.id;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to initialize agent';
			setAgentError(message);
			throw error;
		}
	}, [agentId]);

	return {
		agentId,
		messages,
		append,
		setMessages,
		initializeAgent,
		isThinking,
		setIsThinking,
		getMostCompleteToolInvocation,
		handleSubmit,
		stop,
		isLoading,
		agentError
	};
} 