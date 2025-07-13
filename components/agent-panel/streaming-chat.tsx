"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
	Play,
	Square,
	Loader2,
	Clock,
	Zap,
	CheckCircle,
	AlertCircle,
	MessageSquare,
	Settings
} from "lucide-react";

// Types for streaming events based on our backend implementation
interface StreamEvent {
	id: string;
	event: 'start' | 'toolCall' | 'toolResult' | 'text' | 'budget_exceeded' | 'converged' | 'error' | 'done';
	data: any;
	timestamp?: string;
}

interface ToolBudgetStatus {
	tool_calls_made: number;
	max_tool_calls: number;
	elapsed_time: number;
	time_budget_s: number;
	convergence_detected: boolean;
	confidence_avg: number;
}

interface StreamingChatProps {
	repositoryName: string;
	agentType: string;
	onStreamComplete?: (result: any) => void;
	onError?: (error: string) => void;
	className?: string;
}

export function StreamingChat({
	repositoryName,
	agentType,
	onStreamComplete,
	onError,
	className = ""
}: StreamingChatProps) {
	// State management
	const [query, setQuery] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
	const [currentText, setCurrentText] = useState("");
	const [budgetStatus, setBudgetStatus] = useState<ToolBudgetStatus | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Refs
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const eventSourceRef = useRef<EventSource | null>(null);

	// Auto-scroll to bottom when new events arrive
	const scrollToBottom = useCallback(() => {
		if (scrollAreaRef.current) {
			const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
			if (scrollElement) {
				scrollElement.scrollTop = scrollElement.scrollHeight;
			}
		}
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [streamEvents, currentText, scrollToBottom]);

	// Start streaming
	const startStreaming = useCallback(async () => {
		if (!query.trim() || isStreaming) return;

		setIsStreaming(true);
		setStreamEvents([]);
		setCurrentText("");
		setBudgetStatus(null);
		setError(null);

		try {
			// Create EventSource for streaming
			const url = new URL('/api/v1/agents/execute', window.location.origin);
			url.searchParams.set('repository_name', repositoryName);
			url.searchParams.set('agent_type', agentType);
			url.searchParams.set('user_query', query);
			url.searchParams.set('stream', 'true');

			const eventSource = new EventSource(url.toString());
			eventSourceRef.current = eventSource;

			eventSource.onmessage = (event) => {
				try {
					const streamEvent: StreamEvent = JSON.parse(event.data);

					setStreamEvents(prev => [...prev, streamEvent]);

					// Handle different event types
					switch (streamEvent.event) {
						case 'start':
							setBudgetStatus(streamEvent.data.budget_status);
							break;

						case 'toolCall':
							setBudgetStatus(streamEvent.data.budget_status);
							break;

						case 'toolResult':
							setBudgetStatus(streamEvent.data.budget_status);
							break;

						case 'text':
							setCurrentText(prev => prev + streamEvent.data.content);
							break;

						case 'budget_exceeded':
						case 'converged':
							setBudgetStatus(streamEvent.data.budget_status);
							break;

						case 'error':
							setError(streamEvent.data.error);
							break;

						case 'done':
							setIsStreaming(false);
							onStreamComplete?.(streamEvent.data);
							break;
					}
				} catch (err) {
					console.error('Error parsing stream event:', err);
				}
			};

			eventSource.onerror = (err) => {
				console.error('EventSource error:', err);
				setError('Streaming connection failed');
				setIsStreaming(false);
				eventSource.close();
			};

		} catch (err) {
			console.error('Failed to start streaming:', err);
			setError('Failed to start streaming');
			setIsStreaming(false);
		}
	}, [query, repositoryName, agentType, isStreaming, onStreamComplete]);

	// Stop streaming
	const stopStreaming = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		setIsStreaming(false);
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}
		};
	}, []);

	// Render event badge
	const renderEventBadge = (event: StreamEvent) => {
		const eventConfig = {
			start: { icon: Play, variant: "default" as const, label: "Started" },
			toolCall: { icon: Settings, variant: "secondary" as const, label: "Tool Call" },
			toolResult: { icon: CheckCircle, variant: "outline" as const, label: "Tool Result" },
			text: { icon: MessageSquare, variant: "default" as const, label: "Response" },
			budget_exceeded: { icon: AlertCircle, variant: "destructive" as const, label: "Budget Exceeded" },
			converged: { icon: CheckCircle, variant: "default" as const, label: "Converged" },
			error: { icon: AlertCircle, variant: "destructive" as const, label: "Error" },
			done: { icon: CheckCircle, variant: "default" as const, label: "Complete" }
		};

		const config = eventConfig[event.event];
		const Icon = config.icon;

		return (
			<Badge variant={config.variant} className="flex items-center gap-1">
				<Icon className="w-3 h-3" />
				{config.label}
			</Badge>
		);
	};

	// Render budget status
	const renderBudgetStatus = () => {
		if (!budgetStatus) return null;

		const toolProgress = (budgetStatus.tool_calls_made / budgetStatus.max_tool_calls) * 100;
		const timeProgress = (budgetStatus.elapsed_time / budgetStatus.time_budget_s) * 100;

		return (
			<Card className="mb-4">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm flex items-center gap-2">
						<Zap className="w-4 h-4" />
						Tool Budget Status
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div>
						<div className="flex justify-between text-xs mb-1">
							<span>Tool Calls</span>
							<span>{budgetStatus.tool_calls_made}/{budgetStatus.max_tool_calls}</span>
						</div>
						<Progress value={toolProgress} className="h-2" />
					</div>

					<div>
						<div className="flex justify-between text-xs mb-1">
							<span>Time</span>
							<span>{Math.round(budgetStatus.elapsed_time)}s/{budgetStatus.time_budget_s}s</span>
						</div>
						<Progress value={timeProgress} className="h-2" />
					</div>

					{budgetStatus.convergence_detected && (
						<Badge variant="outline" className="w-full justify-center">
							<CheckCircle className="w-3 h-3 mr-1" />
							Convergence Detected
						</Badge>
					)}

					<div className="text-xs text-muted-foreground">
						Avg Confidence: {Math.round(budgetStatus.confidence_avg * 100)}%
					</div>
				</CardContent>
			</Card>
		);
	};

	return (
		<div className={`flex flex-col h-full ${className}`}>
			{/* Query Input */}
			<Card className="mb-4">
				<CardContent className="pt-4">
					<div className="space-y-3">
						<Textarea
							placeholder={`Ask ${agentType} agent about ${repositoryName}...`}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							disabled={isStreaming}
							className="min-h-[100px]"
							role="textbox"
							aria-label={`Query input for ${agentType} agent`}
						/>

						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Badge variant="outline">{agentType}</Badge>
								<Separator orientation="vertical" className="h-4" />
								<span>{repositoryName}</span>
							</div>

							<div className="flex gap-2">
								{isStreaming ? (
									<Button
										onClick={stopStreaming}
										variant="destructive"
										size="sm"
										className="flex items-center gap-2"
										type="button"
										aria-label="Stop streaming"
									>
										<Square className="w-4 h-4" />
										Stop
									</Button>
								) : (
									<Button
										onClick={startStreaming}
										disabled={!query.trim()}
										size="sm"
										className="flex items-center gap-2"
										type="button"
										aria-label="Start streaming"
									>
										<Play className="w-4 h-4" />
										Start Streaming
									</Button>
								)}
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Budget Status */}
			{renderBudgetStatus()}

			{/* Error Display */}
			{error && (
				<Alert variant="destructive" className="mb-4">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{/* Stream Events */}
			<Card className="flex-1 flex flex-col">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm flex items-center gap-2">
						{isStreaming ? (
							<>
								<Loader2 className="w-4 h-4 animate-spin" />
								Streaming...
							</>
						) : (
							<>
								<MessageSquare className="w-4 h-4" />
								Agent Response
							</>
						)}
					</CardTitle>
				</CardHeader>

				<CardContent className="flex-1 p-0">
					<ScrollArea ref={scrollAreaRef} className="h-full p-4">
						<div className="space-y-4">
							{/* Stream Events */}
							{streamEvents.map((event, index) => (
								<div key={index} className="space-y-2">
									<div className="flex items-center gap-2">
										{renderEventBadge(event)}
										{event.timestamp && (
											<span className="text-xs text-muted-foreground flex items-center gap-1">
												<Clock className="w-3 h-3" />
												{new Date(event.timestamp).toLocaleTimeString()}
											</span>
										)}
									</div>

									{/* Event Data */}
									{event.event === 'toolCall' && (
										<div className="bg-muted p-3 rounded-md text-sm">
											<div className="font-medium">Tool: {event.data.tool_name}</div>
											{event.data.arguments && (
												<pre className="mt-1 text-xs text-muted-foreground">
													{JSON.stringify(event.data.arguments, null, 2)}
												</pre>
											)}
										</div>
									)}

									{event.event === 'toolResult' && (
										<div className="bg-muted p-3 rounded-md text-sm">
											<div className="font-medium">Result:</div>
											<div className="mt-1 text-xs whitespace-pre-wrap">
												{typeof event.data.result === 'string'
													? event.data.result.slice(0, 500) + (event.data.result.length > 500 ? '...' : '')
													: JSON.stringify(event.data.result, null, 2)
												}
											</div>
										</div>
									)}

									{index < streamEvents.length - 1 && <Separator />}
								</div>
							))}

							{/* Current Text Stream */}
							{currentText && (
								<div className="space-y-2">
									<Separator />
									<div className="flex items-center gap-2">
										<Badge variant="default" className="flex items-center gap-1">
											<MessageSquare className="w-3 h-3" />
											Response
										</Badge>
									</div>
									<div className="prose prose-sm max-w-none">
										<div className="whitespace-pre-wrap">{currentText}</div>
										{isStreaming && (
											<span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
										)}
									</div>
								</div>
							)}

							{/* Empty State */}
							{streamEvents.length === 0 && !currentText && !isStreaming && (
								<div className="text-center text-muted-foreground py-8">
									<MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
									<p>Enter a query and start streaming to see the agent response</p>
								</div>
							)}
						</div>
					</ScrollArea>
				</CardContent>
			</Card>
		</div>
	);
} 