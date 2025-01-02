import { ToolInvocation } from "ai";
import { cn, formatMetric, parseToolResult } from "@/lib/utils";
import type { ToolResult } from "@/types/tool-result";
import Image from 'next/image';

export function ToolInvocationDisplay({ toolInvocation }: { toolInvocation: ToolInvocation }) {
	const { toolName, state, args, result } = toolInvocation as (
		| { state: 'partial-call' | 'call'; toolName: string; args: any; result?: never }
		| { state: 'result'; toolName: string; args: any; result: ToolResult }
	);

	return (
		<div className="mt-2 text-sm rounded-lg border p-4 bg-muted/50">
			<div className="flex items-center gap-2 mb-2">
				<div className="font-medium">{toolName}</div>
				<div className={cn(
					"text-xs px-2 py-0.5 rounded-full",
					state === "result"
						? "bg-green-500/10 text-green-700 dark:text-green-300"
						: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
				)}>
					{state}
				</div>
			</div>

			{args && (
				<details className="mb-2">
					<summary className="text-xs text-muted-foreground mb-1 cursor-pointer hover:text-foreground">
						Arguments
					</summary>
					<pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
						{JSON.stringify(typeof args === 'string' ? JSON.parse(args) : args, null, 2)}
					</pre>
				</details>
			)}

			{state === "result" && result && (
				<div className="space-y-2">
					{/* Error Display */}
					{result.error && typeof result.error === 'object' ? (
						<div className="text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-300 p-2 rounded text-xs">
							{result.error || 'An error occurred'}
						</div>
					) : (
						<>
							{/* Output Display */}
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

							{/* Plots Display */}
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
													src={plotData.startsWith('data:') ? plotData : `data:image/png;base64,${plotData}`}
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

							{/* Metrics Display */}
							{result.metrics && (
								<div className="flex gap-4 text-xs text-muted-foreground mt-2">
									<div>Memory: {formatMetric(result.metrics.memory_usage, 'memory')}</div>
									<div>CPU: {formatMetric(result.metrics.cpu_percent, 'cpu')}</div>
									<div>Time: {formatMetric(result.metrics.execution_time, 'time')}</div>
								</div>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
} 