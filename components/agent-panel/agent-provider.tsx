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
	selectedRepository: string | null;
	setSelectedRepository: (value: string | null) => void;
	docAgentId: string | null;
	setDocAgentId: (value: string | null) => void;
	mermaidAgentId: string | null;
	setMermaidAgentId: (value: string | null) => void;
}

const AgentPanelContext = createContext<AgentPanelContextType | undefined>(undefined);

export function AgentPanelProvider({ children }: { children: ReactNode }) {
	const [storedIsOpen, setStoredIsOpen] = useLocalStorage('agent-panel-is-open', false);
	const [storedActiveView, setStoredActiveView] = useLocalStorage<ViewType>('agent-panel-active-view', 'documentation');
	const [storedRepository, setStoredRepository] = useLocalStorage<string | null>('agent-panel-repository', null);
	const [storedDocAgentId, setStoredDocAgentId] = useLocalStorage<string | null>('agent-panel-doc-agent-id', null);
	const [storedMermaidAgentId, setStoredMermaidAgentId] = useLocalStorage<string | null>('agent-panel-mermaid-agent-id', null);

	const [isOpen, setIsOpen] = useState(storedIsOpen);
	const [activeView, setActiveView] = useState<ViewType>(storedActiveView);
	const [selectedRepository, setSelectedRepository] = useState<string | null>(storedRepository);
	const [docAgentId, setDocAgentId] = useState<string | null>(storedDocAgentId);
	const [mermaidAgentId, setMermaidAgentId] = useState<string | null>(storedMermaidAgentId);

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

	// Persist selected repository changes
	useEffect(() => {
		if (isMounted) {
			setStoredRepository(selectedRepository);
		}
	}, [selectedRepository, setStoredRepository, isMounted]);

	// Persist doc agent ID changes
	useEffect(() => {
		if (isMounted) {
			setStoredDocAgentId(docAgentId);
		}
	}, [docAgentId, setStoredDocAgentId, isMounted]);

	// Persist mermaid agent ID changes
	useEffect(() => {
		if (isMounted) {
			setStoredMermaidAgentId(mermaidAgentId);
		}
	}, [mermaidAgentId, setStoredMermaidAgentId, isMounted]);

	const toggle = useCallback(() => {
		setIsOpen(current => !current);
	}, []);

	const value = {
		// Don't show panel until we're mounted and have determined the correct state
		isOpen: isMounted ? isOpen : false,
		toggle,
		setIsOpen,
		activeView: isMounted ? activeView : null,
		setActiveView,
		selectedRepository: isMounted ? selectedRepository : null,
		setSelectedRepository,
		docAgentId: isMounted ? docAgentId : null,
		setDocAgentId,
		mermaidAgentId: isMounted ? mermaidAgentId : null,
		setMermaidAgentId
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