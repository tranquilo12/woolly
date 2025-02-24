'use client';

import { motion, AnimatePresence } from "framer-motion";
import { useAgentPanel } from "./agent-provider";
import { Bot } from "lucide-react";
import { Button } from "../ui/button";
import { useRef, RefObject, useState } from "react";
import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/utils";
import { AgentContent } from "./agent-content";
import { usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { MermaidView } from "./mermaid-view";
import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { useSystemPrompt } from "@/hooks/use-system-prompt";
import { AvailableRepository } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface AgentResponse {
	id: string;
	name: string;
	description: string;
	system_prompt: string;
	tools: string[];
	created_at: string;
	is_active: boolean;
	repository: string | null;
}

export function AgentPanel() {
	const { isOpen, toggle, setIsOpen } = useAgentPanel();
	const { repositories } = useRepositoryStatus();
	const { data: systemPrompt } = useSystemPrompt();
	const [selectedRepo, setSelectedRepo] = useState<AvailableRepository | null>(null);
	const [activeTab, setActiveTab] = useState<'documentation' | 'mermaid'>('documentation');
	const [docAgentId, setDocAgentId] = useState<string | null>(null);
	const [mermaidAgentId, setMermaidAgentId] = useState<string | null>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const pathname = usePathname();
	const chatId = pathname?.split('/').pop() || '';

	useClickOutside(panelRef as RefObject<HTMLElement>, () => {
		if (isOpen) {
			setIsOpen(false);
		}
	});

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: { duration: 0.2 }
		},
		exit: {
			opacity: 0,
			transition: { duration: 0.15 }
		}
	};

	const contentVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: { delay: 0.1, duration: 0.2 }
		}
	};

	return (
		<div className="agent-panel-container relative">
			<AnimatePresence mode="wait">
				{isOpen && (
					<motion.div
						ref={panelRef}
						initial="hidden"
						animate="visible"
						exit="exit"
						variants={containerVariants}
						className={cn(
							"fixed right-0 top-[var(--navbar-height)] z-40",
							"h-[calc(100vh-var(--navbar-height))]",
							"w-full md:w-[clamp(400px,35%,800px)]",
							"border-l border-border/50",
							"bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
						)}
					>
						<motion.div
							className="flex flex-col w-full h-full"
							variants={contentVariants}
							initial="hidden"
							animate="visible"
						>
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
										defaultValue="documentation"
										className="flex-1"
										onValueChange={(value) => setActiveTab(value as 'documentation' | 'mermaid')}
									>
										<TabsList className="w-full grid grid-cols-2 h-9">
											<TabsTrigger value="documentation">Documentation</TabsTrigger>
											<TabsTrigger value="mermaid">Diagrams</TabsTrigger>
										</TabsList>

										<TabsContent value="documentation" className="flex-1 mt-0 h-[calc(100vh-220px)]">
											{activeTab === 'documentation' && docAgentId && (
												<AgentContent
													className="h-full"
													currentChatId={chatId}
													selectedRepo={selectedRepo}
													agentId={docAgentId}
												/>
											)}
										</TabsContent>
										<TabsContent value="mermaid" className="flex-1 mt-0 h-[calc(100vh-220px)]">
											{activeTab === 'mermaid' && mermaidAgentId && (
												<MermaidView
													currentChatId={chatId}
													className="h-full"
													selectedRepo={selectedRepo}
													agentId={mermaidAgentId}
												/>
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
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
} 