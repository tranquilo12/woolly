import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Code } from "lucide-react";
import { useState } from "react";

interface CodeContextContainerProps {
	children: React.ReactNode;
	codeBlockCount: number;
	initiallyExpanded?: boolean;
}

export function CodeContextContainer({
	children,
	codeBlockCount,
	initiallyExpanded = true
}: CodeContextContainerProps) {
	const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

	if (codeBlockCount === 0) return null;

	return (
		<motion.div
			layout
			className="relative mb-4 border rounded-lg bg-zinc-950/50 backdrop-blur-sm w-full"
			initial={{ opacity: 0, y: -10 }}
			animate={{
				opacity: 1,
				y: 0,
				transition: { duration: 0.2 }
			}}
			exit={{ opacity: 0, y: -10 }}
		>
			<div className="flex items-center justify-between border-b border-zinc-800/50">
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className="flex-1 px-2 py-1.5 flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-300"
				>
					<Code className="h-3 w-3" />
					{isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					)}
					<span className="font-mono">Code Context ({codeBlockCount} files)</span>
				</button>
			</div>

			<AnimatePresence initial={false}>
				{isExpanded && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="overflow-hidden divide-y divide-zinc-800/30"
					>
						<div className="p-0.5">
							{children}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
} 