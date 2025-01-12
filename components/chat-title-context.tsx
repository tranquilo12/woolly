import { createContext, useContext, useState, useCallback } from 'react';

interface ChatTitleContextType {
	title: string;
	setTitle: (title: string) => void;
}

const ChatTitleContext = createContext<ChatTitleContextType>({
	title: '',
	setTitle: () => { }
});

export function ChatTitleProvider({ children }: { children: React.ReactNode }) {
	const [title, setTitleState] = useState('');

	// Memoize setTitle to prevent unnecessary rerenders
	const setTitle = useCallback((newTitle: string) => {
		setTitleState(prev => {
			if (prev === newTitle) return prev;
			return newTitle;
		});
	}, []);

	return (
		<ChatTitleContext.Provider value={{ title, setTitle }}>
			{children}
		</ChatTitleContext.Provider>
	);
}

export const useChatTitle = () => useContext(ChatTitleContext); 