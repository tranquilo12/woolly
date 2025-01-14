'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useWindowSize } from 'usehooks-ts';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface DocumentationPanelContextType {
	isOpen: boolean;
	toggle: () => void;
	setIsOpen: (value: boolean) => void;
	isPinned: boolean;
	setIsPinned: (value: boolean) => void;
}

const DocumentationPanelContext = createContext<DocumentationPanelContextType | undefined>(undefined);

export function DocumentationPanelProvider({ children }: { children: ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const [isPinned, setIsPinned] = useLocalStorage('documentation-panel-pinned', false);
	const { width } = useWindowSize();

	useEffect(() => {
		if (!isPinned) {
			setIsOpen(false);
		}
	}, [width, isPinned]);

	useEffect(() => {
		if (isPinned) {
			setIsOpen(true);
		}
	}, [isPinned]);

	const toggle = useCallback(() => {
		if (!isPinned) {
			setIsOpen(current => !current);
		}
	}, [isPinned]);

	return (
		<DocumentationPanelContext.Provider value={{ isOpen, toggle, setIsOpen, isPinned, setIsPinned }}>
			{children}
		</DocumentationPanelContext.Provider>
	);
}

export function useDocumentationPanel() {
	const context = useContext(DocumentationPanelContext);
	if (context === undefined) {
		throw new Error('useDocumentationPanel must be used within a DocumentationPanelProvider');
	}
	return context;
}