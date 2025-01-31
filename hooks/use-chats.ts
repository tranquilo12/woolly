import { useQuery } from '@tanstack/react-query';

export function useChats() {
	return useQuery({
		queryKey: ['chats'],
		queryFn: async () => {
			const response = await fetch('/api/chats');
			if (!response.ok) throw new Error('Failed to fetch chats');
			return response.json();
		},
		staleTime: 30000,
	});
} 