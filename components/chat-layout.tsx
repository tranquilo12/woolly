'use client';

import { Sidebar } from './sidebar';
import { AgentPanel } from './agent-panel/agent-panel';
import { SplitLayout } from './split-layout';

interface ChatLayoutProps {
	children: React.ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
	return (
		<SplitLayout
			sidebar={<Sidebar />}
			content={children}
			agentPanel={<AgentPanel />}
		/>
	);
} 