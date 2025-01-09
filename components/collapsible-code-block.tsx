import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { CodeBlock } from "./code-block";

interface CollapsibleCodeBlockProps {
	language: string;
	value: string;
	filePath?: string;
}

export function CollapsibleCodeBlock({ language, value, filePath }: CollapsibleCodeBlockProps) {
	const [isExpanded, setIsExpanded] = useState(false);

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

			<AnimatePresence initial={false}>
				{isExpanded && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="overflow-hidden"
					>
						<div className="px-0.5">
							<CodeBlock language={language} value={value} />
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}