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
import { useEffect, useState } from "react";

interface DocumentationViewProps {
	repo_name: AvailableRepository;
	agent_id: string;
	file_paths: string[];
	chat_id: string;
}

export function DocumentationView({ repo_name, agent_id, file_paths, chat_id }: DocumentationViewProps) {
	const [containerRef, endRef, scrollToBottom] = useScrollToBottom<HTMLDivElement>();
	const [initialMessages, setInitialMessages] = useState<Message[]>([]);

	// Fetch initial agent messages
	useEffect(() => {
		const fetchAgentMessages = async () => {
			try {
				const response = await fetch(`/api/chat/${chat_id}/agent/${agent_id}/messages`);
				if (!response.ok) throw new Error('Failed to fetch agent messages');
				const messages = await response.json();
				setInitialMessages(messages);
			} catch (error) {
				console.error('Failed to load agent messages:', error);
			}
		};

		if (chat_id && agent_id) {
			fetchAgentMessages();
		}
	}, [chat_id, agent_id]);

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
		initialMessages: [],
		body: {
			model: "gpt-4o-mini",
			agent_id: agent_id,
			repo_name: repo_name,
			file_paths: file_paths,
			chat_id: chat_id,
		},
		onResponse: (response) => {
			scrollToBottom({ force: true });
		},
		onFinish: () => {
			scrollToBottom({ force: true, behavior: 'smooth' });
		}
	});

	// Debug logs
	useEffect(() => {
		console.log('Initial Messages:', initialMessages);
		console.log('Streaming Messages:', streamingMessages);
	}, [initialMessages, streamingMessages]);

	// Ensure no duplicate messages by using message IDs
	const allMessages = [...initialMessages, ...streamingMessages].reduce((acc, message) => {
		const exists = acc.find(m => m.id === message.id);
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
		<div className="flex flex-col gap-4 h-full">
			<div className="flex items-center justify-between">
				<Button
					size="sm"
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
						size="sm"
						variant="ghost"
						onClick={() => stop()}
						className="gap-2"
					>
						<Loader2 className="h-4 w-4 animate-spin" />
						Stop
					</Button>
				)}
			</div>

			<ScrollArea className="flex-1">
				<div ref={containerRef} className="p-4 space-y-4">
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