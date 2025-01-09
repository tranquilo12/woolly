import { motion } from "framer-motion";

interface ThinkingMessageProps {
	isToolStreaming?: boolean;
}

export const ThinkingMessage = ({ isToolStreaming }: ThinkingMessageProps) => {
	return (
		<motion.div
			className="w-full mx-auto max-w-3xl"
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			transition={{ duration: 0.2, ease: "easeOut" }}
		>
			<div className="flex justify-center py-4">
				<motion.span
					className="text-sm text-muted-foreground font-medium"
					animate={{ opacity: [0.5, 1, 0.5] }}
					transition={{ duration: 1.5, repeat: Infinity }}
				>
					{isToolStreaming ? "Running tools..." : "Loading chat..."}
				</motion.span>
			</div>
		</motion.div>
	);
};