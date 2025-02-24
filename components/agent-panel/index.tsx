import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Skeleton } from '../ui/skeleton';
import { AvailableRepository } from '@/lib/constants';
import { useAgentPanel } from './agent-provider';

interface AgentPanelProps {
	repo_name: AvailableRepository;
	agent_id: string;
	file_paths: string[];
	chat_id: string;
}

// Dynamically import heavy components
const DocumentationView = dynamic(
	() => import('./documentation-view').then(mod => mod.DocumentationView),
	{
		loading: () => <Skeleton className="w-full h-4" />,
		ssr: false
	}
);

const MermaidView = dynamic(
	() => import('./mermaid-view').then(mod => mod.MermaidView),
	{
		loading: () => <Skeleton className="w-full h-4" />,
		ssr: false
	}
);

// Main AgentPanel component with proper props
export function AgentPanel({ repo_name, agent_id, file_paths, chat_id }: AgentPanelProps) {
	const {
		isOpen,
		isPinned,
		activeView,
		setActiveView
	} = useAgentPanel();

	if (!isOpen) return null;

	return (
		<div className="agent-panel w-full h-full border-l bg-background">
			<Suspense fallback={<Skeleton className="w-full h-4" />}>
				{activeView === 'documentation' && (
					<DocumentationView
						repo_name={repo_name}
						agent_id={agent_id}
						file_paths={file_paths}
						chat_id={chat_id}
					/>
				)}
				{activeView === 'mermaid' && (
					<MermaidView
						className="h-full"
						currentChatId={chat_id}
						selectedRepo={repo_name}
						agentId={agent_id}
					/>
				)}
			</Suspense>
		</div>
	);
}

// Add display name for better debugging
AgentPanel.displayName = 'AgentPanel';