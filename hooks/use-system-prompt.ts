import { useQuery } from '@tanstack/react-query';

export function useSystemPrompt() {
	return useQuery({
		queryKey: ['system-prompt'],
		queryFn: async () => {
			const response = await fetch('/api/docs_system_prompt.txt');
			if (!response.ok) throw new Error('Failed to fetch system prompt');
			return response.text();
		},
		staleTime: Infinity, // System prompt rarely changes
	});
} 