'use client';

import { ChatTitleProvider } from './chat-title-context';
import { SidebarProvider } from './sidebar-provider';
import { ChatListProvider } from './chat-list-context';
import { AgentPanelProvider } from './agent-panel/agent-provider';
import { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});

export function Providers({ children }: { children: React.ReactNode }) {
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	const refreshChats = useCallback(() => {
		setRefreshTrigger(prev => prev + 1);
	}, []);

	return (
		<QueryClientProvider client={queryClient}>
			<SidebarProvider>
				<AgentPanelProvider>
					<ChatListProvider>
						<ChatTitleProvider>
							{children}
						</ChatTitleProvider>
					</ChatListProvider>
				</AgentPanelProvider>
			</SidebarProvider>
			{process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
		</QueryClientProvider>
	);
}