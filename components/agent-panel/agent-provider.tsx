'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';

type ViewType = 'documentation' | 'mermaid' | null;

interface AgentPanelContextType {
	isOpen: boolean;
	toggle: () => void;
	setIsOpen: (value: boolean) => void;
	activeView: ViewType;
}

const AgentPanelContext = createContext<AgentPanelContextType | undefined>(undefined);

export function AgentPanelProvider({ children }: { children: ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const [activeView, setActiveView] = useState<ViewType>('documentation');
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const toggle = useCallback(() => {
		setIsOpen(current => !current);
	}, []);

	const value = {
		isOpen: isMounted ? isOpen : false,
		toggle,
		setIsOpen,
		activeView,
		setActiveView
	};

	return (
		<AgentPanelContext.Provider value={value}>
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