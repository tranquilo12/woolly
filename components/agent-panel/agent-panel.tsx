'use client';

import { useAgentPanel } from "./agent-provider";
import { Bot, HelpCircle, Maximize2, Minimize2 } from "lucide-react";
import { Suspense, memo, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { useSystemPrompt } from "@/hooks/use-system-prompt";
import { AvailableRepository } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { DocumentationView, MermaidView, PanelSkeleton } from "./views";
import { PipelineIcon } from "../icons";
import { Button } from "../ui/button";

export interface AgentPanelProps {
	repo_name?: AvailableRepository;
	agent_id?: string;
	file_paths?: string[];
	chat_id?: string;
}

// Main AgentPanel component that handles both direct props and repository selection
export const AgentPanel = memo(function AgentPanel(props: AgentPanelProps) {
	const {
		isOpen,
		activeView,
		selectedRepository: contextSelectedRepo,
		setSelectedRepository,
		docAgentId: contextDocAgentId,
		setDocAgentId: setContextDocAgentId,
		mermaidAgentId: contextMermaidAgentId,
		setMermaidAgentId: setContextMermaidAgentId
	} = useAgentPanel();

	const { repositories } = useRepositoryStatus();
	const { data: systemPrompt } = useSystemPrompt();

	// Use the repository from props or context
	const [selectedRepo, setSelectedRepo] = useState<AvailableRepository | null>(() => {
		// First prioritize props if provided
		if (props.repo_name) return props.repo_name;

		// Then use the repository from context
		if (contextSelectedRepo) {
			// Validate that it's a valid repository
			const isValidRepo = repositories.some(repo => repo.name === contextSelectedRepo);
			if (isValidRepo) return contextSelectedRepo as AvailableRepository;
		}

		// Default to null if nothing found
		return null;
	});

	// Update the context when selectedRepo changes
	useEffect(() => {
		if (selectedRepo !== contextSelectedRepo) {
			setSelectedRepository(selectedRepo);
		}
	}, [selectedRepo, contextSelectedRepo, setSelectedRepository]);

	const [activeTab, setActiveTab] = useState<'documentation' | 'mermaid'>(activeView || 'documentation');

	// Use agent IDs from props or context
	const [docAgentId, setDocAgentId] = useState<string | null>(() => {
		// First prioritize props if provided
		if (props.agent_id) return props.agent_id;

		// Then use the agent ID from context
		if (contextDocAgentId) return contextDocAgentId;

		// Default to null if nothing found
		return null;
	});

	const [mermaidAgentId, setMermaidAgentId] = useState<string | null>(contextMermaidAgentId);

	// Update the context when agent IDs change
	useEffect(() => {
		if (docAgentId !== contextDocAgentId) {
			setContextDocAgentId(docAgentId);
		}
	}, [docAgentId, contextDocAgentId, setContextDocAgentId]);

	useEffect(() => {
		if (mermaidAgentId !== contextMermaidAgentId) {
			setContextMermaidAgentId(mermaidAgentId);
		}
	}, [mermaidAgentId, contextMermaidAgentId, setContextMermaidAgentId]);

	const [isMaximized, setIsMaximized] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);
	const pathname = usePathname();
	const chatId = props.chat_id || pathname?.split('/').pop() || '';

	// Get agent IDs from localStorage
	useEffect(() => {
		if (typeof window !== 'undefined' && selectedRepo) {
			try {
				const docAgentId = localStorage.getItem(`doc_agent_${selectedRepo}`);
				if (docAgentId) {
					setDocAgentId(docAgentId);
				}
			} catch (error) {
				// Error handling without console.error
			}

			try {
				const mermaidAgentId = localStorage.getItem(`mermaid_agent_${selectedRepo}`);
				if (mermaidAgentId) {
					setMermaidAgentId(mermaidAgentId);
				}
			} catch (error) {
				// Error handling without console.error
			}
		}
	}, [selectedRepo]);

	// Toggle maximize/minimize panel
	const toggleMaximize = () => {
		setIsMaximized(!isMaximized);
		// This would ideally communicate with the parent layout to adjust sizes
		// For now, we'll just add a class that can be styled with CSS
	};

	// Create a handler for repository selection that updates the state
	const handleRepoChange = (value: string) => {
		const repo = value as AvailableRepository;
		setSelectedRepo(repo);
		setSelectedRepository(repo);
	};

	// If we have direct props, render the content directly
	if (props.repo_name && props.agent_id) {
		// Ensure agent_id is a string
		const safeAgentId = String(props.agent_id);

		return (
			<Card className={cn(
				"agent-panel w-full h-full border-l",
				!isOpen && "invisible w-0",
				isMaximized && "agent-panel-maximized"
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
							selectedRepo={props.repo_name}
						/>
					)}
				</Suspense>
			</Card>
		);
	}

	// Otherwise, render the full panel with repository selection
	return (
		<Card
			ref={panelRef}
			className={cn(
				"h-full w-full",
				"border-l border-border/50",
				"bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
				!isOpen && "invisible w-0",
				isMaximized && "agent-panel-maximized"
			)}
		>
			<div className="flex flex-col w-full h-full">
				<CardHeader className="flex flex-col space-y-4 p-4 border-b border-border/50">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2">
								<div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10">
									<Bot className="h-5 w-5 text-primary" />
								</div>
								<CardTitle className="text-lg">AI Assistant</CardTitle>
							</div>

							<Select
								value={selectedRepo || ""}
								onValueChange={handleRepoChange}
							>
								<SelectTrigger className={cn(
									"w-[180px] bg-background/50",
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

						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={toggleMaximize}
								title={isMaximized ? "Minimize panel" : "Maximize panel"}
							>
								{isMaximized ?
									<Minimize2 className="h-4 w-4" /> :
									<Maximize2 className="h-4 w-4" />
								}
							</Button>

							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={() => window.open('/help/pipelines', '_blank')}
								title="Learn about AI pipelines"
							>
								<HelpCircle className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{selectedRepo && (
						<Tabs
							defaultValue={activeTab}
							className="flex-1"
							onValueChange={(value) => setActiveTab(value as 'documentation' | 'mermaid')}
						>
							<TabsList className="w-full grid grid-cols-2 h-9 mb-6">
								<TabsTrigger value="documentation" className="flex items-center gap-1">
									<PipelineIcon size={16} />
									<span>Pipelines</span>
								</TabsTrigger>
								<TabsTrigger value="mermaid">Diagrams</TabsTrigger>
							</TabsList>
						</Tabs>
					)}
				</CardHeader>

				<CardContent className="flex-1 p-0">
					{selectedRepo ? (
						<Tabs
							defaultValue={activeTab}
							className="h-full"
							onValueChange={(value) => setActiveTab(value as 'documentation' | 'mermaid')}
						>
							<TabsContent value="documentation" className="flex-1 mt-0 h-full">
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
							<TabsContent value="mermaid" className="flex-1 mt-0 h-full">
								{activeTab === 'mermaid' && (
									<Suspense fallback={<PanelSkeleton />}>
										{selectedRepo && (
											<MermaidView
												selectedRepo={selectedRepo}
											/>
										)}
									</Suspense>
								)}
							</TabsContent>
						</Tabs>
					) : (
						<div className="flex flex-col items-center justify-center flex-1 p-6 text-muted-foreground">
							<Bot className="h-12 w-12 mb-4 opacity-50" />
							<p className="text-sm">Select a repository to begin</p>
						</div>
					)}
				</CardContent>
			</div>
		</Card>
	);
});

AgentPanel.displayName = 'AgentPanel'; 