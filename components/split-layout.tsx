'use client';

import Split from 'react-split';
import { useSidebar } from './sidebar-provider';
import { useAgentPanel } from './agent-panel/agent-provider';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useWindowSize } from 'usehooks-ts';

interface SplitLayoutProps {
	sidebar: React.ReactNode;
	content: React.ReactNode;
	agentPanel: React.ReactNode;
}

export function SplitLayout({ sidebar, content, agentPanel }: SplitLayoutProps) {
	const { isOpen: isSidebarOpen } = useSidebar();
	const { isOpen: isAgentOpen } = useAgentPanel();
	const { width } = useWindowSize();
	const [sizes, setSizes] = useState([20, 40, 40]);

	// Simplified size handling
	useEffect(() => {
		if (width < 768) {
			setSizes([0, 100, 0]);
		} else {
			// Updated default sizes to give equal importance to chat and agent panels
			setSizes([20, 40, 40]);
		}
	}, [width]);

	// Store user's custom split sizes in localStorage
	const handleDragEnd = (newSizes: number[]) => {
		setSizes(newSizes);
		try {
			localStorage.setItem('split-layout-sizes', JSON.stringify(newSizes));
		} catch (error) {
			console.error('Failed to save split sizes to localStorage', error);
		}
	};

	// Load user's preferred split sizes on mount
	useEffect(() => {
		try {
			const savedSizes = localStorage.getItem('split-layout-sizes');
			if (savedSizes && width >= 768) {
				setSizes(JSON.parse(savedSizes));
			}
		} catch (error) {
			console.error('Failed to load split sizes from localStorage', error);
		}
	}, [width]);

	return (
		<Split
			sizes={sizes}
			minSize={[250, 400, 250]} // Minimum widths
			gutterSize={2}
			className="split h-[calc(100vh-var(--navbar-height))]"
			onDragEnd={handleDragEnd}
			snapOffset={0} // Remove snap effect
		>
			<div className="h-full overflow-hidden">
				{sidebar}
			</div>
			<div className="h-full min-w-[400px]">
				{content}
			</div>
			<div className="h-full overflow-hidden">
				{agentPanel}
			</div>
		</Split>
	);
} 