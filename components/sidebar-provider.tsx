'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useWindowSize } from 'usehooks-ts';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface SidebarContextType {
	isOpen: boolean;
	toggle: () => void;
	setIsOpen: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const { width } = useWindowSize();

	useEffect(() => {
		if (width < 768) {
			setIsOpen(false);
		}
	}, [width]);

	const toggle = useCallback(() => {
		setIsOpen(current => !current);
	}, []);

	const value = {
		isOpen,
		toggle,
		setIsOpen
	};

	return (
		<SidebarContext.Provider value={value}>
			{children}
		</SidebarContext.Provider>
	);
}

export const useSidebar = () => {
	const context = useContext(SidebarContext);
	if (context === undefined) {
		throw new Error('useSidebar must be used within a SidebarProvider');
	}
	return context;
}; 