import dynamic from 'next/dynamic';
import { memo } from 'react';
import { Skeleton } from '../ui/skeleton';
import { AvailableRepository } from '@/lib/constants';

// Memoize the loading skeleton for consistent reuse
export const PanelSkeleton = memo(() => (
	<Skeleton className="w-full h-full min-h-[200px] rounded-none" />
));
PanelSkeleton.displayName = 'PanelSkeleton';

// Dynamically import views with better loading states
export const DocumentationView = dynamic(
	() => import('./documentation-view').then(mod => mod.DocumentationView),
	{
		loading: () => <PanelSkeleton />,
		ssr: false // Documentation view is client-only
	}
);

export const MermaidView = dynamic(
	() => import('./mermaid-view').then(mod => mod.MermaidView),
	{
		loading: () => <PanelSkeleton />,
		ssr: false // Mermaid rendering is client-only
	}
);

export interface AgentViewProps {
	currentChatId: string;
	selectedRepo: AvailableRepository;
	agentId: string;
	className?: string;
} 