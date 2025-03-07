import dynamic from 'next/dynamic';
import { memo } from 'react';
import { Skeleton } from '../ui/skeleton';
import { AvailableRepository } from '@/lib/constants';

// Memoize the loading skeleton for consistent reuse
export const PanelSkeleton = memo(() => (
	<div className="flex flex-col p-4 space-y-6 animate-pulse">
		{/* Header skeleton */}
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2">
				<Skeleton className="h-8 w-8 rounded-md" />
				<Skeleton className="h-6 w-32" />
			</div>
			<Skeleton className="h-8 w-24" />
		</div>

		{/* Strategy selector skeleton */}
		<div className="space-y-3">
			<Skeleton className="h-4 w-32" />
			<div className="space-y-2">
				<Skeleton className="h-20 w-full rounded-md" />
				<Skeleton className="h-20 w-full rounded-md" />
			</div>
		</div>

		{/* Progress indicator skeleton */}
		<div className="space-y-2">
			<Skeleton className="h-4 w-24" />
			<div className="flex gap-1">
				{Array(5).fill(0).map((_, i) => (
					<Skeleton key={i} className="h-2 w-full rounded-full" />
				))}
			</div>
		</div>

		{/* Content skeleton */}
		<div className="space-y-4 flex-1">
			<Skeleton className="h-32 w-full rounded-md" />
			<Skeleton className="h-32 w-full rounded-md" />
			<Skeleton className="h-32 w-full rounded-md" />
		</div>
	</div>
));
PanelSkeleton.displayName = 'PanelSkeleton';

// Dynamically import views with better loading states
export const DocumentationView = dynamic(() => import('./documentation-view').then(mod => ({ default: mod.DocumentationView })), {
	ssr: false,
	loading: () => <PanelSkeleton />
});

export const MermaidView = dynamic(() => import('./mermaid-view').then(mod => ({ default: mod.MermaidView })), {
	ssr: false,
	loading: () => <PanelSkeleton />
});

export interface AgentViewProps {
	currentChatId: string;
	selectedRepo: AvailableRepository;
	agentId: string;
	className?: string;
} 