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
	const [isExpanded, setIsExpanded] = useState(true);

	return (
		<div className="border rounded-lg my-2 bg-zinc-950">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full px-4 py-2 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 border-b border-zinc-800"
			>
				{isExpanded ? (
					<ChevronDown className="h-4 w-4" />
				) : (
					<ChevronRight className="h-4 w-4" />
				)}
				{filePath || `${language} snippet`}
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
						<div className="p-1">
							<CodeBlock language={language} value={value} />
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
} 