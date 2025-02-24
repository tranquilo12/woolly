import dynamic from 'next/dynamic';
import { Suspense, memo } from 'react';
import { Skeleton } from '../ui/skeleton';
import { AvailableRepository } from '@/lib/constants';
import { useAgentPanel } from './agent-provider';
import { cn } from '@/lib/utils';

interface AgentPanelProps {
	repo_name: AvailableRepository;
	agent_id: string;
	file_paths: string[];
	chat_id: string;
}

// Memoize the loading skeleton for consistent reuse
const PanelSkeleton = memo(() => (
	<Skeleton className="w-full h-full min-h-[200px] rounded-none" />
));
PanelSkeleton.displayName = 'PanelSkeleton';

// Dynamically import views with better loading states
const DocumentationView = dynamic(
	() => import('./documentation-view').then(mod => mod.DocumentationView),
	{
		loading: () => <PanelSkeleton />,
		ssr: false // Documentation view is client-only
	}
);

const MermaidView = dynamic(
	() => import('./mermaid-view').then(mod => mod.MermaidView),
	{
		loading: () => <PanelSkeleton />,
		ssr: false // Mermaid rendering is client-only
	}
);

// Memoize the panel content to prevent unnecessary rerenders
const PanelContent = memo(({
	activeView,
	props
}: {
	activeView: string;
	props: AgentPanelProps
}) => {
	if (activeView === 'documentation') {
		return <DocumentationView {...props} />;
	}
	if (activeView === 'mermaid') {
		return (
			<MermaidView
				className="h-full"
				currentChatId={props.chat_id}
				selectedRepo={props.repo_name}
				agentId={props.agent_id}
			/>
		);
	}
	return null;
});
PanelContent.displayName = 'PanelContent';

// Main AgentPanel component with proper props
export const AgentPanel = memo(function AgentPanel(props: AgentPanelProps) {
	const { isOpen, activeView } = useAgentPanel();

	return (
		<div className={cn(
			"agent-panel w-full h-full border-l bg-background",
			!isOpen && "invisible w-0"
		)}>
			<Suspense fallback={<PanelSkeleton />}>
				<PanelContent activeView={activeView || 'documentation'} props={props} />
			</Suspense>
		</div>
	);
});

// Add display name for better debugging
AgentPanel.displayName = 'AgentPanel';