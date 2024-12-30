'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWindowSize } from 'usehooks-ts';

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
		setIsOpen(false);
	}, [width]);

	const toggle = () => setIsOpen(!isOpen);

	return (
		<SidebarContext.Provider value={{ isOpen, toggle, setIsOpen }}>
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