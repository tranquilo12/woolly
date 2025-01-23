import Image from "next/image";
import { motion } from "framer-motion";
import { CodeBlock } from "./code-block";
import { Button } from "./ui/button";

export function ToolInvocationDisplay({
	toolInvocation,
	onRetry
}: {
	toolInvocation: {
		id: string;
		toolCallId?: string;
		toolName?: string;
		args?: any;
		state: "call" | "partial-call" | "result" | "error";
		result?: {
			success?: boolean;
			error?: {
				type?: string;
				message?: string;
			};
			output?: string;
			plots?: Record<string, string>;
			metrics?: {
				memory_usage?: number;
				cpu_percent?: number;
				execution_time?: number;
			};
		};
	};
	onRetry?: (toolId: string) => void;
}) {
	const hasError = toolInvocation.result?.error || toolInvocation.state === "error";
	const isLoading = toolInvocation.state === "partial-call" || toolInvocation.state === "call";
	const result = toolInvocation.result;

	const renderInput = (args: any) => {
		if (!args) return null;

		// Handle Python code execution input specifically
		if (args.code) {
			return (
				<div className="space-y-3">
					<div>
						<CodeBlock
							language="python"
							value={args.code}
						/>
					</div>
					<details className="group">
						<summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
							Raw Input
						</summary>
						<div className="mt-2">
							<pre className="text-xs whitespace-pre-wrap break-all bg-muted/20 p-2 rounded">
								{JSON.stringify(args, null, 2)}
							</pre>
						</div>
					</details>
				</div>
			);
		}

		// Fallback for other tool inputs
		return (
			<pre className="whitespace-pre-wrap break-all">
				{JSON.stringify(args, null, 2)}
			</pre>
		);
	};

	return (
		<div className="my-4 border-l-2 border-primary/50 pl-4 space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span className="font-medium">{toolInvocation.toolName || 'Tool Execution'}</span>
					{isLoading && (
						<motion.span
							animate={{ opacity: [0.5, 1, 0.5] }}
							transition={{ duration: 1.5, repeat: Infinity }}
							className="text-primary/70"
						>
							Processing...
						</motion.span>
					)}
				</div>
				{hasError && onRetry && toolInvocation.toolCallId && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onRetry(toolInvocation.toolCallId!)}
						className="h-6 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
					>
						Retry
					</Button>
				)}
			</div>

			<div className="rounded-md bg-muted/30 border border-muted">
				{toolInvocation.args && (
					<div className="p-3 text-xs font-mono">
						{renderInput(toolInvocation.args)}
					</div>
				)}

				{hasError && (
					<div className="p-3 border-t border-destructive/20 bg-destructive/10">
						<div className="text-xs font-mono text-destructive">
							{result?.error?.type && (
								<span className="font-medium block mb-1">{result.error.type}</span>
							)}
							{result?.error?.message || 'An error occurred during tool execution'}
						</div>
					</div>
				)}

				{result && !hasError && (
					<div className="border-t border-muted">
						{result.output && (
							<details className="group" open>
								<summary className="p-3 text-xs cursor-pointer hover:bg-muted/50 transition-colors">
									<span className="text-muted-foreground group-hover:text-foreground">
										Output
									</span>
								</summary>
								<div className="p-3 pt-0 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
									{result.output}
								</div>
							</details>
						)}

						{result.plots && Object.entries(result.plots).length > 0 && (
							<details className="group border-t border-muted">
								<summary className="p-3 text-xs cursor-pointer hover:bg-muted/50 transition-colors">
									<span className="text-muted-foreground group-hover:text-foreground">
										Plots ({Object.entries(result.plots).length})
									</span>
								</summary>
								<div className="p-3 pt-0 space-y-4">
									{Object.entries(result.plots).map(([name, plotData]) => (
										<div key={name} className="space-y-2">
											<div className="text-xs text-muted-foreground">{name}</div>
											<Image
												src={typeof plotData === 'string' ? (plotData.startsWith('data:') ? plotData : `data:image/png;base64,${plotData}`) : ''}
												alt={`Plot: ${name}`}
												width={600}
												height={400}
												className="max-w-full h-auto rounded border border-muted"
												unoptimized={true}
											/>
										</div>
									))}
								</div>
							</details>
						)}

						{result.metrics && (
							<div className="p-3 border-t border-muted">
								<div className="text-xs text-muted-foreground mb-2">Metrics</div>
								<div className="grid grid-cols-3 gap-2 text-xs">
									{result.metrics.memory_usage !== undefined && (
										<div>Memory: {result.metrics.memory_usage.toFixed(2)}MB</div>
									)}
									{result.metrics.cpu_percent !== undefined && (
										<div>CPU: {result.metrics.cpu_percent.toFixed(1)}%</div>
									)}
									{result.metrics.execution_time !== undefined && (
										<div>Time: {result.metrics.execution_time.toFixed(2)}s</div>
									)}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
} 