import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, lazy, Suspense } from "react";

const CodeBlock = lazy(() => import("./code-block").then(module => ({ default: module.CodeBlock })));

interface CollapsibleCodeBlockProps {
	language: string;
	value: string;
	filePath?: string;
	initiallyExpanded?: boolean;
}

export function CollapsibleCodeBlock({
	language,
	value,
	filePath,
	initiallyExpanded = false
}: CollapsibleCodeBlockProps) {
	const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

	return (
		<div className="border-b border-zinc-800/50 last:border-b-0">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full px-2 py-1 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/30"
			>
				{isExpanded ? (
					<ChevronDown className="h-3 w-3" />
				) : (
					<ChevronRight className="h-3 w-3" />
				)}
				<span className="font-mono">{filePath || `${language} snippet`}</span>
			</button>

			<div
				className="code-block-content"
				style={{
					maxHeight: isExpanded ? '100vh' : '0',
					visibility: isExpanded ? 'visible' : 'hidden'
				}}
			>
				{isExpanded && (
					<div className="px-0.5">
						<Suspense fallback={<div className="p-4 text-sm text-zinc-400">Loading code...</div>}>
							<CodeBlock language={language} value={value} />
						</Suspense>
					</div>
				)}
			</div>
		</div>
	);
}