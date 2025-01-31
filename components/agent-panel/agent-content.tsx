'use client';

import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { useState, useEffect } from "react";
import { AvailableRepository } from "@/lib/constants";
import { DocumentationView } from "./documentation-view";

interface AgentResponse {
	id: string;
	name: string;
	description: string;
	system_prompt: string;
	tools: string[];
	created_at: string;
	is_active: boolean;
}

interface AgentContentProps {
	className?: string;
	currentChatId: string;
}

export function AgentContent({ className, currentChatId }: AgentContentProps) {
	const { repositories } = useRepositoryStatus();
	const [selectedRepo, setSelectedRepo] = useState<AvailableRepository | null>(null);
	const [agentId, setAgentId] = useState<string | null>(() => {
		// Try to get from localStorage first
		const savedId = localStorage.getItem(`doc_agent_${currentChatId}`);
		return savedId;
	});

	useEffect(() => {
		const createDocumentationAgent = async () => {
			// If we already have an agent ID for this chat, use it
			if (agentId) return;

			try {
				const response = await fetch('/api/agents', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						name: `Documentation Agent ${currentChatId}`,
						description: 'Documentation generation agent',
						system_prompt: await fetch('/api/docs_system_prompt.txt').then(r => r.text()),
						tools: ['fetch_repo_content']
					}),
				});

				if (!response.ok) throw new Error('Failed to create agent');
				const data: AgentResponse = await response.json();

				// Save to localStorage and state
				localStorage.setItem(`doc_agent_${currentChatId}`, data.id);
				setAgentId(data.id);
			} catch (error) {
				console.error('Failed to create documentation agent:', error);
			}
		};

		createDocumentationAgent();
	}, [currentChatId, agentId]);

	return (
		<div className={cn("flex flex-col w-full h-[calc(100vh-var(--navbar-height))]", className)}>
			<div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
				<div className="flex items-center gap-2">
					<Bot className="h-5 w-5" />
					<h3 className="font-semibold">Documentation Agent</h3>
				</div>
			</div>

			<div className="px-4 py-2 border-b border-border/50">
				<Select
					value={selectedRepo || ""}
					onValueChange={(value) => setSelectedRepo(value as AvailableRepository)}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Select repository" />
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

			<div className="flex-1 overflow-y-auto">
				<div className="h-full px-4">
					{selectedRepo && agentId ? (
						<DocumentationView
							repo_name={selectedRepo}
							agent_id={agentId}
							file_paths={[]}
							chat_id={currentChatId}
						/>
					) : (
						<div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
							<Bot className="h-8 w-8" />
							<p className="text-sm">Select a repository to generate documentation</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
} 