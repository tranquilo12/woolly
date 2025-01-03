'use client';

import { createContext, useContext } from 'react';

interface ChatListContextType {
	refreshChats: () => void;
	refreshTrigger: number;
}

const ChatListContext = createContext<ChatListContextType>({
	refreshChats: () => { },
	refreshTrigger: 0,
});

export function ChatListProvider({ children, refreshChats, refreshTrigger }: {
	children: React.ReactNode;
	refreshChats: () => void;
	refreshTrigger: number;
}) {
	return (
		<ChatListContext.Provider value={{ refreshChats, refreshTrigger }}>
			{children}
		</ChatListContext.Provider>
	);
}

export const useChatList = () => useContext(ChatListContext); 