'use client';

import { useAgentPanel } from "./agent-provider";
import { Bot } from "lucide-react";
import { Suspense, memo, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { useSystemPrompt } from "@/hooks/use-system-prompt";
import { AvailableRepository } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { DocumentationView, MermaidView, PanelSkeleton } from "./views";

export interface AgentPanelProps {
	repo_name?: AvailableRepository;
	agent_id?: string;
	file_paths?: string[];
	chat_id?: string;
}

// Main AgentPanel component that handles both direct props and repository selection
export const AgentPanel = memo(function AgentPanel(props: AgentPanelProps) {
	const { isOpen, activeView } = useAgentPanel();
	const { repositories } = useRepositoryStatus();
	const { data: systemPrompt } = useSystemPrompt();
	const [selectedRepo, setSelectedRepo] = useState<AvailableRepository | null>(props.repo_name || null);
	const [activeTab, setActiveTab] = useState<'documentation' | 'mermaid'>(activeView || 'documentation');
	const [docAgentId, setDocAgentId] = useState<string | null>(props.agent_id || null);
	const [mermaidAgentId, setMermaidAgentId] = useState<string | null>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const pathname = usePathname();
	const chatId = props.chat_id || pathname?.split('/').pop() || '';

	useEffect(() => {
		if (selectedRepo) {
			// Initialize or retrieve documentation agent with string handling
			const storedDocId = localStorage.getItem(`doc_agent_${selectedRepo}`);
			if (storedDocId) {
				try {
					// Ensure we're storing a valid string
					setDocAgentId(String(storedDocId));
				} catch (error) {
					console.error('Invalid doc agent ID in localStorage:', error);
					localStorage.removeItem(`doc_agent_${selectedRepo}`);
				}
			}

			// Initialize or retrieve mermaid agent with string handling
			const storedMermaidId = localStorage.getItem(`mermaid_agent_${selectedRepo}`);
			if (storedMermaidId) {
				try {
					// Ensure we're storing a valid string
					setMermaidAgentId(String(storedMermaidId));
				} catch (error) {
					console.error('Invalid mermaid agent ID in localStorage:', error);
					localStorage.removeItem(`mermaid_agent_${selectedRepo}`);
				}
			}
		}
	}, [selectedRepo]);

	// If we have direct props, render the content directly
	if (props.repo_name && props.agent_id) {
		// Ensure agent_id is a string
		const safeAgentId = String(props.agent_id);

		return (
			<div className={cn(
				"agent-panel w-full h-full border-l bg-background",
				!isOpen && "invisible w-0"
			)}>
				<Suspense fallback={<PanelSkeleton />}>
					{activeView === 'documentation' ? (
						<DocumentationView
							repo_name={props.repo_name}
							agent_id={safeAgentId}
							file_paths={props.file_paths || []}
							chat_id={props.chat_id || ''}
						/>
					) : (
						<MermaidView
							className="h-full"
							currentChatId={props.chat_id || ''}
							selectedRepo={props.repo_name}
							agentId={safeAgentId}
						/>
					)}
				</Suspense>
			</div>
		);
	}

	// Otherwise, render the full panel with repository selection
	return (
		<div
			ref={panelRef}
			className={cn(
				"h-full w-full",
				"border-l border-border/50",
				"bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
				!isOpen && "invisible w-0"
			)}
		>
			<div className="flex flex-col w-full h-full">
				<div className="flex flex-col space-y-4 p-4 border-b border-border/50">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-2">
							<Bot className="h-5 w-5 text-muted-foreground" />
							<h2 className="text-lg font-semibold">AI Assistant</h2>
						</div>

						<Select
							value={selectedRepo || ""}
							onValueChange={(value) => setSelectedRepo(value as AvailableRepository)}
						>
							<SelectTrigger className={cn(
								"w-[200px] bg-background/50",
								"border-border/50 hover:border-border",
								"focus:ring-1 focus:ring-ring text-sm"
							)}>
								<SelectValue placeholder="Select Repository" />
							</SelectTrigger>
							<SelectContent>
								{repositories.map((repo) => (
									<SelectItem key={repo.name} value={repo.name}>
										{repo.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{selectedRepo && (
						<Tabs
							defaultValue={activeTab}
							className="flex-1"
							onValueChange={(value) => setActiveTab(value as 'documentation' | 'mermaid')}
						>
							<TabsList className="w-full grid grid-cols-2 h-9">
								<TabsTrigger value="documentation">Documentation</TabsTrigger>
								<TabsTrigger value="mermaid">Diagrams</TabsTrigger>
							</TabsList>

							<TabsContent value="documentation" className="flex-1 mt-0 h-[calc(100vh-220px)]">
								{activeTab === 'documentation' && (
									<Suspense fallback={<PanelSkeleton />}>
										{selectedRepo && (
											<DocumentationView
												repo_name={selectedRepo}
												agent_id={docAgentId || ''}
												file_paths={[]}
												chat_id={chatId}
											/>
										)}
									</Suspense>
								)}
							</TabsContent>
							<TabsContent value="mermaid" className="flex-1 mt-0 h-[calc(100vh-220px)]">
								{activeTab === 'mermaid' && (
									<Suspense fallback={<PanelSkeleton />}>
										{selectedRepo && (
											<MermaidView
												className="h-full"
												currentChatId={chatId}
												selectedRepo={selectedRepo}
												agentId={mermaidAgentId || ''}
											/>
										)}
									</Suspense>
								)}
							</TabsContent>
						</Tabs>
					)}
				</div>

				{!selectedRepo && (
					<div className="flex flex-col items-center justify-center flex-1 p-6 text-muted-foreground">
						<Bot className="h-12 w-12 mb-4 opacity-50" />
						<p className="text-sm">Select a repository to begin</p>
					</div>
				)}
			</div>
		</div>
	);
});

AgentPanel.displayName = 'AgentPanel'; 