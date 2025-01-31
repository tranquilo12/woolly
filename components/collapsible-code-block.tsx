import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface CollapsibleCodeBlockProps {
	language: string;
	value: string;
	initiallyExpanded?: boolean;
}

export function CollapsibleCodeBlock({
	language,
	value,
	initiallyExpanded = true
}: CollapsibleCodeBlockProps) {
	const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
	const [isCopied, setIsCopied] = useState(false);

	const copyToClipboard = async () => {
		await navigator.clipboard.writeText(value);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	};

	return (
		<div className="my-4 rounded-lg border bg-muted/50">
			<div className="flex items-center justify-between px-3 py-2">
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					<ChevronDown
						className={cn(
							"h-3 w-3 transition-transform duration-150",
							isExpanded ? "rotate-180" : ""
						)}
					/>
					<span className="font-mono">{language}</span>
				</button>
				<button
					onClick={copyToClipboard}
					className="p-1 hover:bg-muted rounded-md transition-colors"
					title="Copy code"
				>
					{isCopied ? (
						<Check className="h-3.5 w-3.5" />
					) : (
						<Copy className="h-3.5 w-3.5" />
					)}
				</button>
			</div>

			<div
				className={cn(
					"transition-all duration-200",
					isExpanded ? "block" : "hidden"
				)}
			>
				<SyntaxHighlighter
					language={language}
					style={coldarkDark}
					customStyle={{
						margin: 0,
						background: 'transparent',
						fontSize: '0.875rem',
						padding: '1rem',
						borderBottomLeftRadius: '0.5rem',
						borderBottomRightRadius: '0.5rem',
					}}
				>
					{value}
				</SyntaxHighlighter>
			</div>
		</div>
	);
}