import { createContext, useContext, useState } from 'react';

interface ChatContextType {
	title: string;
	setTitle: (title: string) => void;
}

const ChatContext = createContext<ChatContextType>({ title: '', setTitle: () => { } });

export function ChatProvider({ children }: { children: React.ReactNode }) {
	const [title, setTitle] = useState('');

	return (
		<ChatContext.Provider value={{ title, setTitle }}>
			{children}
		</ChatContext.Provider>
	);
}

export const useChat = () => useContext(ChatContext); 