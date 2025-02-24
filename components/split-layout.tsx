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
	const { isOpen: isSidebarOpen, setIsOpen: setSidebarOpen } = useSidebar();
	const { isOpen: isAgentOpen, setIsOpen: setAgentOpen } = useAgentPanel();
	const { width } = useWindowSize();
	const [sizes, setSizes] = useState([15, 70, 15]);
	const [isResizing, setIsResizing] = useState(false);

	// Handle panel visibility changes and responsive behavior
	useEffect(() => {
		if (width < 768) {
			// On mobile, close both panels
			if (isSidebarOpen) setSidebarOpen(false);
			if (isAgentOpen) setAgentOpen(false);
			setSizes([0, 100, 0]);
		} else {
			// On desktop, set appropriate sizes based on panel states
			if (!isSidebarOpen && !isAgentOpen) {
				setSizes([0, 100, 0]);
			} else if (!isSidebarOpen && isAgentOpen) {
				setSizes([0, 70, 30]);
			} else if (isSidebarOpen && !isAgentOpen) {
				setSizes([30, 70, 0]);
			} else {
				setSizes([25, 50, 25]);
			}
		}
	}, [isSidebarOpen, isAgentOpen, width, setSidebarOpen, setAgentOpen]);

	const handleDragStart = () => {
		setIsResizing(true);
	};

	const handleDragEnd = (newSizes: number[]) => {
		setIsResizing(false);

		if (JSON.stringify(sizes) !== JSON.stringify(newSizes)) {
			setSizes(newSizes);
		}

		// Update panel states based on size thresholds
		if (newSizes[0] < 5 && isSidebarOpen) {
			setSidebarOpen(false);
		} else if (newSizes[0] >= 5 && !isSidebarOpen) {
			setSidebarOpen(true);
		}

		if (newSizes[2] < 5 && isAgentOpen) {
			setAgentOpen(false);
		} else if (newSizes[2] >= 5 && !isAgentOpen) {
			setAgentOpen(true);
		}
	};

	return (
		<Split
			sizes={sizes}
			minSize={[0, 400, 0]}
			gutterSize={2}
			className={cn(
				"split h-[calc(100vh-var(--navbar-height))]",
				isResizing && "select-none"
			)}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			snapOffset={20}
		>
			<div className={cn(
				"h-full overflow-hidden transition-[width] duration-200",
				isSidebarOpen ? "min-w-[250px]" : "w-0"
			)}>
				{sidebar}
			</div>
			<div className="h-full min-w-[400px]">
				{content}
			</div>
			<div className={cn(
				"h-full overflow-hidden transition-[width] duration-200",
				isAgentOpen ? "min-w-[250px]" : "w-0"
			)}>
				{agentPanel}
			</div>
		</Split>
	);
} 