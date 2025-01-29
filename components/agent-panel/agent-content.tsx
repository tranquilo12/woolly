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
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { AvailableRepository } from "@/lib/constants";
import { DocumentationView } from "./documentation-view";

interface AgentContentProps {
	className?: string;
}

export function AgentContent({ className }: AgentContentProps) {
	const { repositories } = useRepositoryStatus();
	const [selectedRepo, setSelectedRepo] = useState<AvailableRepository | null>(null);
	const agentId = uuidv4();
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
					{selectedRepo ? (
						<DocumentationView
							repo_name={selectedRepo}
							agent_id={agentId}
							file_paths={[]}
							id={`docs-${selectedRepo}`}
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