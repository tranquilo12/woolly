import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface CodeBlockProps {
	language: string;
	value: string;
}

export function CodeBlock({ language, value }: CodeBlockProps) {
	const [isCopied, setIsCopied] = useState(false);

	const copyToClipboard = async () => {
		await navigator.clipboard.writeText(value);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	};

	return (
		<div className="relative group">
			<div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
				<button
					onClick={copyToClipboard}
					className="p-2 hover:bg-muted rounded-md transition-colors"
				>
					{isCopied ? (
						<Check className="h-4 w-4" />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</button>
			</div>
			<SyntaxHighlighter
				language={language}
				style={oneDark}
				customStyle={{
					margin: 0,
					padding: "1.5rem",
					borderRadius: "0.5rem",
					fontSize: "0.875rem",
					lineHeight: "1.5",
				}}
			>
				{value}
			</SyntaxHighlighter>
		</div>
	);
} 