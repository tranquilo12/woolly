'use client';

import { cn } from "@/lib/utils";
import { AvailableRepository } from "@/lib/constants";
import { DocumentationView } from "./documentation-view";


interface AgentContentProps {
	className?: string;
	currentChatId: string;
	selectedRepo: AvailableRepository;
	agentId: string;
}

export function AgentContent({ className, currentChatId, selectedRepo, agentId }: AgentContentProps) {
	return (
		<div className={cn("flex flex-col w-full h-full overflow-hidden", className)}>
			<div className="h-full">
				<DocumentationView
					repo_name={selectedRepo}
					agent_id={agentId}
					file_paths={[]}
					chat_id={currentChatId}
				/>
			</div>
		</div>
	);
} 