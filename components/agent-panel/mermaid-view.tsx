'use client';

import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { MermaidDiagram } from './mermaid-diagram';
import { ScrollArea } from '../ui/scroll-area';
import { useSystemPrompt } from '@/hooks/use-system-prompt';
import { useState, useEffect } from 'react';
import { AvailableRepository } from '@/lib/constants';
import { Loader2, Bot } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Message } from 'ai';
import { toast } from 'sonner';

interface MermaidViewProps {
	selectedRepo: AvailableRepository;
}

export function MermaidView({ selectedRepo }: MermaidViewProps) {
	const [diagramPrompt, setDiagramPrompt] = useState("Please analyze the codebase and generate a Mermaid diagram showing the component relationships.");
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
					// Error handling without console.error
					toast.error('Failed to setup diagram agent');
				}
			} catch (error) {
				// Error handling without console.error
				toast.error('Failed to setup diagram agent');
			}
		};

		setupMermaidAgent();
	}, [selectedRepo, isAgentReady]);

	// Get agent ID from localStorage
	const agentId = typeof window !== 'undefined' ? localStorage.getItem(`mermaid_agent_${selectedRepo}`) : null;
	const safeAgentId = agentId || '';

	// Setup chat for streaming
	const {
		messages: streamingMessages = [],
		append,
		isLoading,
		stop
	} = useChat({
		transport: new DefaultChatTransport({
			api: `/api/agents/${safeAgentId}/chat`,
			body: {
				repository: selectedRepo,
				system_prompt: systemPrompt,
			},
		}),
		id: `mermaid-${selectedRepo}`,
		onError: () => {
			toast.error('Failed to generate diagram');
		}
	});

	// Extract mermaid diagram from messages
	const extractMermaidDiagram = (messages: Message[]): string => {
		for (const message of messages) {
			if (message.role === 'assistant') {
				const content = message.content || '';
				const mermaidMatch = content.match(/```mermaid([\s\S]*?)```/);
				if (mermaidMatch && mermaidMatch[1]) {
					return mermaidMatch[1].trim();
				}
			}
		}
		return '';
	};

	const mermaidDiagram = extractMermaidDiagram(streamingMessages);

	const handleGenerateDiagram = async () => {
		try {
			await append({
				role: 'user',
				content: diagramPrompt,
				id: `${Date.now()}`,
			});
		} catch (error) {
			// Error handling without console.error
			toast.error('Failed to generate diagram');
		}
	};

	if (!isAgentReady && !agentId) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
					<p className="text-muted-foreground">Setting up diagram agent...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			<div className="flex-none p-4 border-b">
				<div className="flex items-start gap-4">
					<Textarea
						value={diagramPrompt}
						onChange={(e) => setDiagramPrompt(e.target.value)}
						placeholder="Enter your diagram prompt..."
						className="min-h-[100px] flex-1"
					/>
					<Button
						onClick={handleGenerateDiagram}
						disabled={isLoading || !diagramPrompt.trim()}
						className="mt-2"
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<Bot className="mr-2 h-4 w-4" />
								Generate
							</>
						)}
					</Button>
				</div>
			</div>

			<ScrollArea className="flex-1 p-4">
				{mermaidDiagram ? (
					<MermaidDiagram content={mermaidDiagram} />
				) : (
					<div className="text-center py-12 text-muted-foreground">
						{isLoading ? (
							<div className="animate-pulse">Generating diagram...</div>
						) : (
							<p>Generate a diagram to visualize your codebase</p>
						)}
					</div>
				)}
			</ScrollArea>
		</div>
	);
} 