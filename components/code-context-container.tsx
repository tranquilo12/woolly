import { ChevronDown, Code } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CodeContextContainerProps {
	children: React.ReactNode;
	codeBlockCount: number;
	initiallyExpanded?: boolean;
}

export function CodeContextContainer({
	children,
	codeBlockCount,
	initiallyExpanded = false
}: CodeContextContainerProps) {
	const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

	if (codeBlockCount === 0) return null;

	return (
		<div className="relative mb-4 border rounded-lg bg-background/50 w-full">
			<div className="flex items-center justify-between border-b">
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className="flex-1 px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
				>
					<Code className="h-3 w-3" />
					<ChevronDown
						className={cn(
							"h-3 w-3 transition-transform duration-200 ease-out",
							isExpanded ? "rotate-180" : ""
						)}
					/>
					<span className="font-mono">Code Context ({codeBlockCount} files)</span>
				</button>
			</div>

			<div
				className={cn(
					"overflow-hidden",
					isExpanded ? "animate-in fade-in slide-in-from-top-1 duration-300 ease-out" : "animate-out fade-out slide-out-to-top-1 duration-200 ease-in"
				)}
				style={{
					maxHeight: isExpanded ? '5000px' : '0px',
					transition: 'max-height 300ms cubic-bezier(0.4, 0, 0.2, 1)'
				}}
			>
				<div className={cn(
					"p-2 transition-opacity duration-300",
					isExpanded ? "opacity-100" : "opacity-0"
				)}>
					{children}
				</div>
			</div>
		</div>
	);
} 