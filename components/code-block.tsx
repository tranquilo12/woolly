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
		<div className="relative group overflow-x-auto">
			<div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
				<button
					onClick={copyToClipboard}
					className="p-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
				>
					{isCopied ? <Check size={8} /> : <Copy size={8} />}
				</button>
			</div>
			<SyntaxHighlighter
				language={language}
				style={oneDark}
				customStyle={{
					margin: 0,
					borderRadius: '0.5rem',
					padding: '1rem',
					fontSize: '0.75rem',
					overflowX: 'auto',
				}}
			>
				{value}
			</SyntaxHighlighter>
		</div>
	);
} 