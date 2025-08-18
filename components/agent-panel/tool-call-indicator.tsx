"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Loader2,
	CheckCircle,
	AlertCircle,
	Clock,
	Settings,
	ChevronDown,
	ChevronRight,
	Search,
	MessageSquare,
	Database,
	FileText,
	Zap
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Tool call status types
type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout';

// Tool call data interface
interface ToolCallData {
	id: string;
	tool_name: string;
	arguments: Record<string, any>;
	status: ToolCallStatus;
	start_time: string;
	end_time?: string;
	duration_ms?: number;
	result?: any;
	error?: string;
	progress?: number; // 0-100 for tools that support progress
}

interface ToolCallIndicatorProps {
	toolCall: ToolCallData;
	showDetails?: boolean;
	onToggleDetails?: () => void;
	className?: string;
}

// Tool icon mapping
const getToolIcon = (toolName: string) => {
	const iconMap: Record<string, React.ComponentType<any>> = {
		'search_code': Search,
		'qa_codebase': MessageSquare,
		'find_entities': Database,
		'get_entity_relationships': Database,
		'repo_get_info': FileText,
		'generate_diagram': FileText,
		'default': Settings
	};

	return iconMap[toolName] || iconMap.default;
};

// Status color mapping
const getStatusConfig = (status: ToolCallStatus) => {
	const configs = {
		pending: {
			color: "bg-gray-500",
			variant: "secondary" as const,
			icon: Clock,
			label: "Pending"
		},
		running: {
			color: "bg-blue-500",
			variant: "default" as const,
			icon: Loader2,
			label: "Running"
		},
		completed: {
			color: "bg-green-500",
			variant: "default" as const,
			icon: CheckCircle,
			label: "Completed"
		},
		failed: {
			color: "bg-red-500",
			variant: "destructive" as const,
			icon: AlertCircle,
			label: "Failed"
		},
		timeout: {
			color: "bg-orange-500",
			variant: "destructive" as const,
			icon: AlertCircle,
			label: "Timeout"
		}
	};

	return configs[status];
};

// Format duration
const formatDuration = (durationMs: number) => {
	if (durationMs < 1000) {
		return `${durationMs}ms`;
	} else if (durationMs < 60000) {
		return `${(durationMs / 1000).toFixed(1)}s`;
	} else {
		return `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`;
	}
};

// Format tool arguments for display
const formatArguments = (args: Record<string, any>) => {
	// Truncate long values and format nicely
	const formatted: Record<string, any> = {};

	Object.entries(args).forEach(([key, value]) => {
		if (typeof value === 'string' && value.length > 100) {
			formatted[key] = value.slice(0, 100) + '...';
		} else if (typeof value === 'object' && value !== null) {
			formatted[key] = Array.isArray(value) ? `[${value.length} items]` : '[object]';
		} else {
			formatted[key] = value;
		}
	});

	return formatted;
};

// Format result for display
const formatResult = (result: any) => {
	if (typeof result === 'string') {
		return result.length > 300 ? result.slice(0, 300) + '...' : result;
	} else if (typeof result === 'object' && result !== null) {
		return JSON.stringify(result, null, 2);
	} else {
		return String(result);
	}
};

export function ToolCallIndicator({
	toolCall,
	showDetails = false,
	onToggleDetails,
	className = ""
}: ToolCallIndicatorProps) {
	const ToolIcon = getToolIcon(toolCall.tool_name);
	const statusConfig = getStatusConfig(toolCall.status);
	const StatusIcon = statusConfig.icon;

	const duration = toolCall.duration_ms || (
		toolCall.end_time
			? new Date(toolCall.end_time).getTime() - new Date(toolCall.start_time).getTime()
			: Date.now() - new Date(toolCall.start_time).getTime()
	);

	return (
		<Card className={`transition-all duration-200 ${className}`}>
			<CardContent className="p-3">
				<Collapsible open={showDetails} onOpenChange={onToggleDetails}>
					{/* Header */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3 flex-1">
							{/* Tool Icon */}
							<div className="flex-shrink-0">
								<div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
									<ToolIcon className="w-4 h-4" />
								</div>
							</div>

							{/* Tool Info */}
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="font-medium text-sm truncate">
										{toolCall.tool_name}
									</span>
									<Badge variant={statusConfig.variant} className="flex items-center gap-1">
										{toolCall.status === 'running' ? (
											<Loader2 className="w-3 h-3 animate-spin" />
										) : (
											<StatusIcon className="w-3 h-3" />
										)}
										{statusConfig.label}
									</Badge>
								</div>

								{/* Duration */}
								<div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
									<Clock className="w-3 h-3" />
									{formatDuration(duration)}
									{toolCall.status === 'running' && (
										<span className="text-blue-500">• Running</span>
									)}
								</div>
							</div>

							{/* Progress Bar (if available) */}
							{toolCall.progress !== undefined && toolCall.status === 'running' && (
								<div className="w-20">
									<Progress value={toolCall.progress} className="h-2" />
									<span className="text-xs text-muted-foreground">
										{toolCall.progress}%
									</span>
								</div>
							)}
						</div>

						{/* Toggle Details Button */}
						{onToggleDetails && (
							<CollapsibleTrigger asChild>
								<Button variant="ghost" size="sm" className="w-8 h-8 p-0">
									{showDetails ? (
										<ChevronDown className="w-4 h-4" />
									) : (
										<ChevronRight className="w-4 h-4" />
									)}
								</Button>
							</CollapsibleTrigger>
						)}
					</div>

					{/* Details */}
					<CollapsibleContent className="mt-3">
						<div className="space-y-3 pl-11">
							{/* Arguments */}
							{Object.keys(toolCall.arguments).length > 0 && (
								<div>
									<div className="text-xs font-medium text-muted-foreground mb-1">
										Arguments:
									</div>
									<div className="bg-muted p-2 rounded text-xs">
										<pre className="whitespace-pre-wrap">
											{JSON.stringify(formatArguments(toolCall.arguments), null, 2)}
										</pre>
									</div>
								</div>
							)}

							{/* Result */}
							{toolCall.result && toolCall.status === 'completed' && (
								<div>
									<div className="text-xs font-medium text-muted-foreground mb-1">
										Result:
									</div>
									<div className="bg-muted p-2 rounded text-xs max-h-32 overflow-y-auto">
										<pre className="whitespace-pre-wrap">
											{formatResult(toolCall.result)}
										</pre>
									</div>
								</div>
							)}

							{/* Error */}
							{toolCall.error && toolCall.status === 'failed' && (
								<div>
									<div className="text-xs font-medium text-red-600 mb-1">
										Error:
									</div>
									<div className="bg-red-50 border border-red-200 p-2 rounded text-xs text-red-700">
										{toolCall.error}
									</div>
								</div>
							)}

							{/* Timestamps */}
							<div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
								<div>
									<span className="font-medium">Started:</span>
									<br />
									{new Date(toolCall.start_time).toLocaleTimeString()}
								</div>
								{toolCall.end_time && (
									<div>
										<span className="font-medium">Ended:</span>
										<br />
										{new Date(toolCall.end_time).toLocaleTimeString()}
									</div>
								)}
							</div>
						</div>
					</CollapsibleContent>
				</Collapsible>
			</CardContent>
		</Card>
	);
}

// Batch tool call indicator for showing multiple tool calls
interface ToolCallBatchProps {
	toolCalls: ToolCallData[];
	title?: string;
	className?: string;
}

export function ToolCallBatch({
	toolCalls,
	title = "Tool Calls",
	className = ""
}: ToolCallBatchProps) {
	const [expandedCalls, setExpandedCalls] = React.useState<Set<string>>(new Set());

	const toggleExpanded = (id: string) => {
		setExpandedCalls(prev => {
			const newSet = new Set(prev);
			if (newSet.has(id)) {
				newSet.delete(id);
			} else {
				newSet.add(id);
			}
			return newSet;
		});
	};

	const stats = {
		total: toolCalls.length,
		completed: toolCalls.filter(tc => tc.status === 'completed').length,
		running: toolCalls.filter(tc => tc.status === 'running').length,
		failed: toolCalls.filter(tc => tc.status === 'failed').length
	};

	const totalDuration = toolCalls.reduce((sum, tc) => {
		const duration = tc.duration_ms || (
			tc.end_time
				? new Date(tc.end_time).getTime() - new Date(tc.start_time).getTime()
				: 0
		);
		return sum + duration;
	}, 0);

	return (
		<Card className={className}>
			<CardContent className="p-4">
				{/* Header */}
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<Zap className="w-4 h-4" />
						<span className="font-medium">{title}</span>
						<Badge variant="outline">
							{stats.total} call{stats.total !== 1 ? 's' : ''}
						</Badge>
					</div>

					<div className="text-xs text-muted-foreground">
						Total: {formatDuration(totalDuration)}
					</div>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-4 gap-2 mb-4">
					<div className="text-center">
						<div className="text-lg font-bold">{stats.completed}</div>
						<div className="text-xs text-green-600">Completed</div>
					</div>
					<div className="text-center">
						<div className="text-lg font-bold">{stats.running}</div>
						<div className="text-xs text-blue-600">Running</div>
					</div>
					<div className="text-center">
						<div className="text-lg font-bold">{stats.failed}</div>
						<div className="text-xs text-red-600">Failed</div>
					</div>
					<div className="text-center">
						<div className="text-lg font-bold">{stats.total}</div>
						<div className="text-xs text-muted-foreground">Total</div>
					</div>
				</div>

				{/* Tool Calls */}
				<div className="space-y-2">
					{toolCalls.map((toolCall) => (
						<ToolCallIndicator
							key={toolCall.id}
							toolCall={toolCall}
							showDetails={expandedCalls.has(toolCall.id)}
							onToggleDetails={() => toggleExpanded(toolCall.id)}
						/>
					))}
				</div>
			</CardContent>
		</Card>
	);
} 