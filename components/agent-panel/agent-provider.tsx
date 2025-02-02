'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface AgentPanelContextType {
	isOpen: boolean;
	toggle: () => void;
	setIsOpen: (value: boolean) => void;
	isPinned: boolean;
	setIsPinned: (value: boolean) => void;
}

const AgentPanelContext = createContext<AgentPanelContextType | undefined>(undefined);

export function AgentPanelProvider({ children }: { children: ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const [isPinned, setIsPinned] = useLocalStorage('agent-panel-pinned', false);

	const toggle = useCallback(() => {
		if (!isPinned) {
			setIsOpen(current => !current);
		}
	}, [isPinned]);

	return (
		<AgentPanelContext.Provider value={{ isOpen, toggle, setIsOpen, isPinned, setIsPinned }}>
			{children}
		</AgentPanelContext.Provider>
	);
}

export function useAgentPanel() {
	const context = useContext(AgentPanelContext);
	if (context === undefined) {
		throw new Error('useAgentPanel must be used within an AgentPanelProvider');
	}
	return context;
} 