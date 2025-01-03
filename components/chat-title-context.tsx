import { createContext, useContext, useState } from 'react';

interface ChatTitleContextType {
	title: string;
	setTitle: (title: string) => void;
}

const ChatTitleContext = createContext<ChatTitleContextType>({
	title: '',
	setTitle: () => { }
});

export function ChatTitleProvider({ children }: { children: React.ReactNode }) {
	const [title, setTitle] = useState('');

	return (
		<ChatTitleContext.Provider value={{ title, setTitle }}>
			{children}
		</ChatTitleContext.Provider>
	);
}

export const useChatTitle = () => useContext(ChatTitleContext); 