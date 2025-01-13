import { cn, formatMetric, parseToolResult } from "@/lib/utils";
import Image from "next/image";

export function ToolInvocationDisplay({ toolInvocation }: {
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
	}
}) {
	const { toolName, args, result } = toolInvocation;
	const hasError = result?.success === false || result?.error;

	return (
		<div className="mt-2 text-sm rounded-lg border p-4 bg-muted/50">
			<div className="flex items-center gap-2 mb-2">
				<div className="font-medium">{toolName}</div>
				<div className={cn(
					"text-xs px-2 py-0.5 rounded-full",
					hasError
						? "bg-red-500/10 text-red-700 dark:text-red-300"
						: result
							? "bg-green-500/10 text-green-700 dark:text-green-300"
							: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
				)}>
					{hasError ? "error" : result ? "completed" : "running"}
				</div>
			</div>

			{args && (
				<details>
					<summary className="text-xs text-muted-foreground mb-1 cursor-pointer hover:text-foreground">
						Arguments
					</summary>
					<pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
						{JSON.stringify(typeof args === 'string' ? JSON.parse(args) : args, null, 2)}
					</pre>
				</details>
			)}

			{hasError && (
				<div className="text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-300 p-2 rounded text-xs">
					{result?.error?.message || 'An error occurred'}
				</div>
			)}

			{result && !hasError && (
				<div className="space-y-2">
					{result.output && (
						<details>
							<summary className="text-xs text-muted-foreground mb-1 cursor-pointer hover:text-foreground">
								Output
							</summary>
							<pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
								{result.output}
							</pre>
						</details>
					)}

					{result.plots && Object.entries(result.plots).length > 0 && (
						<details>
							<summary className="text-xs text-muted-foreground mb-1 cursor-pointer hover:text-foreground">
								Plots
							</summary>
							<div className="mt-2 space-y-4">
								{Object.entries(result.plots).map(([name, plotData]) => (
									<div key={name} className="space-y-2">
										<div className="text-xs text-muted-foreground">{name}</div>
										<Image
											src={typeof plotData === 'string' ? (plotData.startsWith('data:') ? plotData : `data:image/png;base64,${plotData}`) : ''}
											alt={`Plot: ${name}`}
											width={600}
											height={400}
											className="max-w-full h-auto rounded"
											unoptimized={true}
										/>
									</div>
								))}
							</div>
						</details>
					)}

					{result.metrics && (
						<div className="flex gap-4 text-xs text-muted-foreground mt-2">
							{result.metrics.memory_usage && <div>Memory: {formatMetric(result.metrics.memory_usage, 'memory')}</div>}
							{result.metrics.cpu_percent && <div>CPU: {formatMetric(result.metrics.cpu_percent, 'cpu')}</div>}
							{result.metrics.execution_time && <div>Time: {formatMetric(result.metrics.execution_time, 'time')}</div>}
						</div>
					)}
				</div>
			)}
		</div>
	);
} 