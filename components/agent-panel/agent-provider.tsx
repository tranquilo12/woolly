'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useWindowSize } from 'usehooks-ts';

type ViewType = 'documentation' | 'mermaid' | null;

interface AgentPanelContextType {
	isOpen: boolean;
	toggle: () => void;
	setIsOpen: (value: boolean) => void;
	activeView: ViewType;
	setActiveView: (value: ViewType) => void;
}

const AgentPanelContext = createContext<AgentPanelContextType | undefined>(undefined);

export function AgentPanelProvider({ children }: { children: ReactNode }) {
	const [storedIsOpen, setStoredIsOpen] = useLocalStorage('agent-panel-is-open', false);
	const [storedActiveView, setStoredActiveView] = useLocalStorage<ViewType>('agent-panel-active-view', 'documentation');
	const [isOpen, setIsOpen] = useState(storedIsOpen);
	const [activeView, setActiveView] = useState<ViewType>(storedActiveView);
	const { width } = useWindowSize();
	const [isMounted, setIsMounted] = useState(false);

	// Handle initial mount and window size changes
	useEffect(() => {
		setIsMounted(true);

		// On first mount or window resize, set appropriate state
		if (width < 768) {
			setIsOpen(false);
		} else {
			setIsOpen(storedIsOpen);
		}
	}, [width, storedIsOpen]);

	// Persist state changes to localStorage
	useEffect(() => {
		if (isMounted) {
			setStoredIsOpen(isOpen);
		}
	}, [isOpen, setStoredIsOpen, isMounted]);

	// Persist active view changes
	useEffect(() => {
		if (isMounted && activeView) {
			setStoredActiveView(activeView);
		}
	}, [activeView, setStoredActiveView, isMounted]);

	const toggle = useCallback(() => {
		setIsOpen(current => !current);
	}, []);

	const value = {
		// Don't show panel until we're mounted and have determined the correct state
		isOpen: isMounted ? isOpen : false,
		toggle,
		setIsOpen,
		activeView: isMounted ? activeView : null,
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