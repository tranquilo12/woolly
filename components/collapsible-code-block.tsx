import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { CodeBlock } from './code-block';

interface CollapsibleCodeBlockProps {
	language: string;
	value: string;
	initiallyExpanded?: boolean;
}

export function CollapsibleCodeBlock({
	language,
	value,
	initiallyExpanded = false
}: CollapsibleCodeBlockProps) {
	const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

	return (
		<div className="rounded-lg border bg-background/50">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex w-full items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
			>
				<span className="font-mono">{language}</span>
				<ChevronDown
					className={cn(
						"h-3 w-3 transition-transform duration-150 ease-out",
						isExpanded ? "rotate-180" : ""
					)}
				/>
			</button>
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
					"transition-opacity duration-300",
					isExpanded ? "opacity-100" : "opacity-0"
				)}>
					<CodeBlock
						language={language}
						value={value}
					/>
				</div>
			</div>
		</div>
	);
}