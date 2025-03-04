'use client';

import { useChat } from 'ai/react';
import { Message } from "ai";
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Markdown } from '../markdown';
import { ScrollArea } from '../ui/scroll-area';
import { useSystemPrompt } from '@/hooks/use-system-prompt';
import { useState, useEffect } from 'react';
import { AvailableRepository } from '@/lib/constants';
import { Loader2, Bot } from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';

interface AgentResponse {
	id: string;
	name: string;
	repository: string;
}

interface MermaidViewProps {
	className?: string;
	currentChatId: string;
	selectedRepo: AvailableRepository;
	agentId: string;
}

export function MermaidView({ className, currentChatId, selectedRepo, agentId }: MermaidViewProps) {
	const { data: systemPrompt } = useSystemPrompt();
	const [isAgentReady, setIsAgentReady] = useState(false);

	useEffect(() => {
		const setupMermaidAgent = async () => {
			if (!selectedRepo || isAgentReady) return;

			try {
				// First try to get existing agent
				const getResponse = await fetch(`/api/agents?repository=${selectedRepo}&type=mermaid`);

				if (getResponse.ok) {
					const agents = await getResponse.json();
					if (agents.length > 0) {
						// Use existing agent - ensure string storage
						const agentIdString = String(agents[0].id);
						localStorage.setItem(`mermaid_agent_${selectedRepo}`, agentIdString);
						setIsAgentReady(true);
						return;
					}
				}

				// If no existing agent, create new one
				const createResponse = await fetch('/api/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: `Mermaid Agent ${selectedRepo}`,
						description: 'Mermaid diagram generation agent',
						repository: selectedRepo,
						system_prompt: "You are a diagram expert focused on analyzing codebases and generating Mermaid diagrams to visualize component relationships.",
						tools: ['mermaid', 'code_search', 'final_result'],
						type: 'mermaid'
					})
				});

				if (createResponse.ok) {
					const data = await createResponse.json();
					// Ensure string storage of agent ID
					const newAgentIdString = String(data.id);
					localStorage.setItem(`mermaid_agent_${selectedRepo}`, newAgentIdString);
					setIsAgentReady(true);
				} else {
					console.error('Failed to setup mermaid agent:', await createResponse.text());
					toast.error('Failed to setup diagram agent');
				}
			} catch (error) {
				console.error('Failed to setup mermaid agent:', error);
				toast.error('Failed to setup diagram agent');
			}
		};

		setupMermaidAgent();
	}, [selectedRepo, isAgentReady]);

	// Ensure agentId is always a string when passed to useAgentMessages
	const safeAgentId = agentId ? String(agentId) : '';

	const { data: initialMessages = [], isError, isLoading: isLoadingInitial, saveMessage } = useAgentMessages(
		currentChatId,
		safeAgentId,
		selectedRepo,
		'mermaid'
	);

	const {
		messages: streamingMessages = [],
		append,
		isLoading,
		stop
	} = useChat({
		api: `/api/agents/${safeAgentId}/mermaid`,
		experimental_throttle: 50,
		id: currentChatId,
		initialMessages,
		onFinish: (message) => {
			saveMessage({
				agentId: safeAgentId,
				chatId: currentChatId,
				repository: selectedRepo,
				messageType: 'mermaid',
				role: message.role,
				content: message.content,
			});
		},
		body: {
			id: currentChatId,
			repository: selectedRepo,
			content: "Please analyze the codebase and generate a Mermaid diagram showing the component relationships."
		},
	});

	const allMessages = [...(initialMessages || []), ...(streamingMessages || [])].reduce((acc: Message[], message: Message) => {
		const exists = acc.find((m: Message) => m.id === message.id);
		if (!exists) {
			acc.push(message);
		}
		return acc;
	}, [] as Message[]);

	const handleGenerateDiagram = async () => {
		try {
			await append({
				role: 'user',
				content: "Please analyze the codebase and generate a Mermaid diagram showing the component relationships.",
				id: `${Date.now()}`,
			});
		} catch (error) {
			console.error("Failed to generate diagram:", error);
		}
	};

	if (!isAgentReady && !agentId) {
		return <Skeleton className="w-full h-full" />;
	}

	return (
		<div className={cn("flex flex-col h-full overflow-hidden", className)}>
			<div className="flex-none p-4 space-y-4 border-b">
				<h2 className="text-lg font-semibold">Diagrams</h2>
				<p className="text-sm text-muted-foreground">
					Generate visual representations of your codebase structure and relationships.
				</p>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={handleGenerateDiagram}
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
								Generating...
							</>
						) : (
							'Generate Diagram'
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
				<div className="p-4 space-y-4">
					{allMessages.map((message: Message) => (
						<div key={message.id} className="mb-4">
							<Markdown>{message.content}</Markdown>
						</div>
					))}
					{isLoading && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="flex items-center gap-2 text-muted-foreground"
						>
							<Bot className="h-4 w-4" />
							<span className="text-sm">Generating diagram...</span>
						</motion.div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
} 