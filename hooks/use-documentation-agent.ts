import { useState, useCallback, useMemo } from 'react';
import { useParameterizedChat } from './use-parameterized-chat';

interface UseDocumentationAgentProps {
	chatId: string;
}

export function useDocumentationAgent({ chatId }: UseDocumentationAgentProps) {
	const [agentId, setAgentId] = useState<string | null>(null);
	const [agentError, setAgentError] = useState<string | null>(null);

	// Create a memoized endpoint that updates when agentId changes
	const endpoint = useMemo(() =>
		agentId ? `/api/agents/${agentId}/documentation` : null,
		[agentId]
	);

	const chat = useParameterizedChat({
		endpoint: endpoint || '',
		chatId,
		model: 'gpt-4o-mini',
		body: {
			agent_id: agentId,
		},
	});

	const initializeAgent = useCallback(async () => {
		if (agentId) {
			console.log('Using existing agent:', agentId);
			return agentId;
		}

		console.log('Initializing new agent...');
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
			console.log('Agent created:', agent.id);
			setAgentId(agent.id);
			return agent.id;
		} catch (error) {
			console.error('Agent initialization failed:', error);
			const message = error instanceof Error ? error.message : 'Failed to initialize agent';
			setAgentError(message);
			throw error;
		}
	}, [agentId]);

	return {
		agentId,
		messages: chat.messages,
		append: chat.append,
		setMessages: chat.setMessages,
		initializeAgent,
		isThinking: chat.isThinking,
		setIsThinking: chat.setIsThinking,
		getMostCompleteToolInvocation: chat.getMostCompleteToolInvocation,
		handleSubmit: chat.handleSubmit,
		stop: chat.stop,
		isLoading: chat.isLoading,
		agentError
	};
} 