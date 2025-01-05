'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWindowSize } from 'usehooks-ts';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface SidebarContextType {
	isOpen: boolean;
	toggle: () => void;
	setIsOpen: (value: boolean) => void;
	isPinned: boolean;
	setIsPinned: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const [isPinned, setIsPinned] = useLocalStorage('sidebar-pinned', false);
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

	const toggle = () => {
		if (!isPinned) {
			setIsOpen(!isOpen);
		}
	};

	return (
		<SidebarContext.Provider value={{ isOpen, toggle, setIsOpen, isPinned, setIsPinned }}>
			{children}
		</SidebarContext.Provider>
	);
}

export function useSidebar() {
	const context = useContext(SidebarContext);
	if (context === undefined) {
		throw new Error('useSidebar must be used within a SidebarProvider');
	}
	return context;
} 