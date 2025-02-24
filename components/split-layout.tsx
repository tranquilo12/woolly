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
	const [sizes, setSizes] = useState([15, 70, 15]);

	// Handle panel visibility changes with smaller percentages
	useEffect(() => {
		if (!isSidebarOpen && !isAgentOpen) {
			setSizes([0, 100, 0]);
		} else if (!isSidebarOpen && isAgentOpen) {
			setSizes([0, 60, 40]);
		} else if (isSidebarOpen && !isAgentOpen) {
			setSizes([20, 80, 0]);
		} else {
			setSizes([20, 60, 20]);
		}
	}, [isSidebarOpen, isAgentOpen]);

	const handleDragEnd = (newSizes: number[]) => {
		if (JSON.stringify(sizes) !== JSON.stringify(newSizes)) {
			setSizes(newSizes);
		}

		if (newSizes[0] < 3 && isSidebarOpen) {
			setSidebarOpen(false);
		} else if (newSizes[0] > 3 && !isSidebarOpen) {
			setSidebarOpen(true);
		}

		if (newSizes[2] < 3 && isAgentOpen) {
			setAgentOpen(false);
		} else if (newSizes[2] > 3 && !isAgentOpen) {
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
			snapOffset={20}
		>
			<div className={cn(
				"h-full",
				isSidebarOpen ? "min-w-[250px]" : "w-0"
			)}>
				<div className={cn(
					"h-full w-full",
					"transition-all duration-150",
					isSidebarOpen ? "opacity-100 visible" : "opacity-0 invisible"
				)}>
					{sidebar}
				</div>
			</div>
			<div className="h-full min-w-[400px]">
				{content}
			</div>
			<div className={cn(
				"h-full",
				isAgentOpen ? "min-w-[250px]" : "w-0"
			)}>
				<div className={cn(
					"h-full w-full",
					"transition-all duration-150",
					isAgentOpen ? "opacity-100 visible" : "opacity-0 invisible"
				)}>
					{agentPanel}
				</div>
			</div>
		</Split>
	);
} 