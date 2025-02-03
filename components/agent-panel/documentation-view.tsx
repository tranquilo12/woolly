'use client';

import { useChat } from 'ai/react';
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvailableRepository } from "@/lib/constants";
import { Message } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { Markdown } from "../markdown";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useAgentMessages } from '@/hooks/use-agent-messages';

interface DocumentationViewProps {
	repo_name: AvailableRepository;
	agent_id: string;
	file_paths: string[];
	chat_id: string;
}

export function DocumentationView({ repo_name, agent_id, file_paths, chat_id }: DocumentationViewProps) {
	const [containerRef, endRef, scrollToBottom] = useScrollToBottom<HTMLDivElement>();
	const { data: initialMessages, isError, isLoading: isLoadingInitial, saveMessage } = useAgentMessages(
		chat_id,
		agent_id,
		repo_name,
		'documentation'
	);

	const {
		messages: streamingMessages,
		append,
		isLoading,
		error,
		reload,
		stop
	} = useChat({
		api: `/api/agents/${agent_id}/documentation`,
		id: chat_id,
		initialMessages,
		onFinish: (message) => {
			saveMessage({
				agentId: agent_id,
				chatId: chat_id,
				repository: repo_name,
				messageType: 'documentation',
				role: message.role,
				content: message.content,
			});
		},
		body: {
			id: chat_id,
			messages: initialMessages,
			model: "gpt-4o-mini",
			agent_id: agent_id,
			repo_name: repo_name,
			file_paths: file_paths,
			chat_id: chat_id,
		},
	});

	if (isLoadingInitial) {
		return <div className="flex items-center justify-center h-full">
			<Loader2 className="h-8 w-8 animate-spin" />
		</div>;
	}

	if (isError) {
		return <div className="flex items-center justify-center h-full text-destructive">
			Failed to load messages. Please try again.
		</div>;
	}

	// Ensure no duplicate messages by using message IDs
	const allMessages = [...initialMessages, ...streamingMessages].reduce((acc: Message[], message: Message) => {
		const exists = acc.find((m: Message) => m.id === message.id);
		if (!exists) {
			acc.push(message);
		}
		return acc;
	}, [] as Message[]);

	const handleGenerateDoc = async () => {
		try {
			await append({
				role: 'user',
				content: "Additional context for this conversation"
			});
		} catch (error) {
			console.error("Failed to generate documentation:", error);
		}
	};

	const renderMessage = (message: Message) => {
		return (
			<motion.div
				key={message.id}
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -10 }}
				className={cn(
					"group relative w-full transition-all duration-300",
					message.role === "user"
						? "mb-8 hover:bg-muted/30 rounded-lg"
						: "mb-8 hover:bg-primary/5 rounded-lg"
				)}
			>
				<div className="flex items-start gap-4 px-4 py-4">
					<div className={cn(
						"min-w-[30px] text-sm font-medium",
						message.role === "user"
							? "text-muted-foreground"
							: "text-primary"
					)}>
						{message.role === "user" ? "You" : "AI"}
					</div>
					<div className="prose prose-neutral dark:prose-invert flex-1">
						<Markdown>{message.content}</Markdown>
					</div>
				</div>
			</motion.div>
		);
	};

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex-none p-4 space-y-4 border-b">
				<h2 className="text-lg font-semibold">Documentation</h2>
				<p className="text-sm text-muted-foreground">
					Generate comprehensive documentation for your codebase.
				</p>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={handleGenerateDoc}
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
					{isLoading && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => stop()}
							className="gap-2"
						>
							<Loader2 className="h-4 w-4 animate-spin" />
							Stop
						</Button>
					)}
				</div>
			</div>

			<ScrollArea className="flex-1 w-full h-[calc(100%-120px)]">
				<div
					ref={containerRef}
					className="p-4 space-y-4"
				>
					<AnimatePresence mode="popLayout">
						{allMessages.map(renderMessage)}
					</AnimatePresence>

					{isLoading && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="flex items-center gap-2 text-muted-foreground"
						>
							<Bot className="h-4 w-4" />
							<span className="text-sm">Generating documentation...</span>
						</motion.div>
					)}
					<div ref={endRef} />
				</div>
			</ScrollArea>
		</div>
	);
}