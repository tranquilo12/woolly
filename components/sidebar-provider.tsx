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
	const [isOpen] = useState(true); // Always open
	const { width } = useWindowSize();

	const value = {
		isOpen: width >= 768, // Only hide on mobile
		setIsOpen: () => {}, // No-op since we're removing toggle
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