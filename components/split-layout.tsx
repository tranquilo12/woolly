'use client';

import Split from 'react-split';
import { useSidebar } from './sidebar-provider';
import { useAgentPanel } from './agent-panel/agent-provider';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface SplitLayoutProps {
	sidebar: React.ReactNode;
	content: React.ReactNode;
	agentPanel: React.ReactNode;
}

export function SplitLayout({ sidebar, content, agentPanel }: SplitLayoutProps) {
	const { isOpen: isSidebarOpen, setIsOpen: setSidebarOpen } = useSidebar();
	const { isOpen: isAgentOpen, setIsOpen: setAgentOpen } = useAgentPanel();
	const [sizes, setSizes] = useState([30, 40, 30]);

	// Handle panel visibility changes
	useEffect(() => {
		if (!isSidebarOpen && !isAgentOpen) {
			setSizes([0, 100, 0]);
		} else if (!isSidebarOpen && isAgentOpen) {
			setSizes([0, 65, 35]);
		} else if (isSidebarOpen && !isAgentOpen) {
			setSizes([30, 70, 0]);
		} else {
			setSizes([25, 50, 25]);
		}
	}, [isSidebarOpen, isAgentOpen]);

	// Handle resize to update panel visibility
	const handleDragEnd = (newSizes: number[]) => {
		// Only update sizes if they're significantly different
		if (JSON.stringify(sizes) !== JSON.stringify(newSizes)) {
			setSizes(newSizes);
		}

		// Update panel visibility based on size
		if (newSizes[0] < 5 && isSidebarOpen) {
			setSidebarOpen(false);
		} else if (newSizes[0] > 5 && !isSidebarOpen) {
			setSidebarOpen(true);
		}

		if (newSizes[2] < 5 && isAgentOpen) {
			setAgentOpen(false);
		} else if (newSizes[2] > 5 && !isAgentOpen) {
			setAgentOpen(true);
		}
	};

	return (
		<Split
			sizes={sizes}
			minSize={[0, 400, 0]}
			gutterSize={2}
			className="split h-[calc(100vh-var(--navbar-height))]"
			onDragEnd={handleDragEnd}
			snapOffset={30}
		>
			<div className={cn(
				"h-full overflow-hidden transition-all duration-200",
				isSidebarOpen ? "min-w-[200px]" : "w-0"
			)}>
				{sidebar}
			</div>
			<div className="h-full min-w-[400px]">
				{content}
			</div>
			<div className={cn(
				"h-full overflow-hidden transition-all duration-200",
				isAgentOpen ? "min-w-[200px]" : "w-0"
			)}>
				{agentPanel}
			</div>
		</Split>
	);
} 