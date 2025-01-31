'use client';

import { createContext, useContext, useCallback } from 'react';
import { useChats } from '@/hooks/use-chats';
import { useQueryClient } from '@tanstack/react-query';

interface ChatListContextType {
	chats: any[];
	isLoading: boolean;
	refreshChats: () => void;
}

const ChatListContext = createContext<ChatListContextType>({
	chats: [],
	isLoading: false,
	refreshChats: () => { },
});

export function ChatListProvider({ children }: { children: React.ReactNode }) {
	const queryClient = useQueryClient();
	const { data: chats = [], isLoading } = useChats();

	const refreshChats = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['chats'] });
	}, [queryClient]);

	return (
		<ChatListContext.Provider value={{ chats, isLoading, refreshChats }}>
			{children}
		</ChatListContext.Provider>
	);
}

export const useChatList = () => useContext(ChatListContext); 