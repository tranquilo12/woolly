import { ToolInvocation } from "ai";
import { cn } from "@/lib/utils";

export function ToolInvocationDisplay({ toolInvocation }: { toolInvocation: ToolInvocation }) {
	const { toolName, state, args, result } = toolInvocation as (
		| { state: 'partial-call' | 'call'; toolName: string; args: any; result?: never }
		| { state: 'result'; toolName: string; args: any; result: { error?: { message: string }; output?: any } }
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

			{state === "result" && (
				<div>
					<div className="text-xs text-muted-foreground mb-1">Result:</div>
					{result?.error ? (
						<div className="text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-300 p-2 rounded text-xs">
							{result.error.message}
						</div>
					) : (
						<pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
							{JSON.stringify(result, null, 2)}
						</pre>
					)}
				</div>
			)}
		</div>
	);
} 