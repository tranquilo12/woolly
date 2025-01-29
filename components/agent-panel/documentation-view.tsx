'use client';

import { useChat } from 'ai/react';
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvailableRepository } from "@/lib/constants";
import { Message } from "ai";

interface DocumentationViewProps {
	repo_name: AvailableRepository;
	agent_id: string;
	file_paths: string[];
	id: string;
}

export function DocumentationView({ repo_name, agent_id, file_paths, id }: DocumentationViewProps) {
	const { messages, append, input, handleInputChange, handleSubmit, isLoading } = useChat({
		api: `/api/agents/${agent_id}/documentation`,
		id: id,
		initialMessages: [],
		body: {
			repo_name: repo_name,
			model: "gpt-4o-mini",
			agent_id: agent_id,
			file_paths: file_paths,
		}
	});

	return (
		<div className="flex flex-col gap-4 h-full">
			<div className="flex items-center justify-between">
				<Button
					size="sm"
					onClick={() => append({ role: 'user', content: "Additional context for this conversation" })}
					disabled={isLoading}
				>
					{isLoading ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin mr-2" />
							Generating...
						</>
					) : (
						'Generate Documentation'
					)}
				</Button>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-4 space-y-4">
					{messages.map((message: Message) => (
						<div
							key={message.id}
							className={cn(
								"mb-4 flex flex-col",
								message.role === "assistant" && "items-start",
								message.role === "user" && "items-end"
							)}
						>
							<div
								className={cn(
									"rounded-lg px-3 py-2 max-w-[85%] text-sm",
									message.role === "assistant" && "bg-muted",
									message.role === "user" && "bg-primary text-primary-foreground"
								)}
							>
								{message.content}
							</div>
						</div>
					))}
					{isLoading && (
						<div className="flex items-center gap-2 text-muted-foreground">
							<Bot className="h-4 w-4" />
							<span className="text-sm">Generating documentation...</span>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
} 