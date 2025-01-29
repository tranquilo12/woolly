'use client';

import { ChatTitleProvider } from './chat-title-context';
import { SidebarProvider } from './sidebar-provider';
import { ChatListProvider } from './chat-list-context';
import { AgentPanelProvider } from './agent-panel/agent-provider';
import { useState, useCallback } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	const refreshChats = useCallback(() => {
		setRefreshTrigger(prev => prev + 1);
	}, []);

	return (
		<SidebarProvider>
			<AgentPanelProvider>
				<ChatListProvider refreshChats={refreshChats} refreshTrigger={refreshTrigger}>
					<ChatTitleProvider>
						{children}
					</ChatTitleProvider>
				</ChatListProvider>
			</AgentPanelProvider>
		</SidebarProvider>
	);
}