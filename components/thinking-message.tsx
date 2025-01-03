import { motion } from "framer-motion";

interface ThinkingMessageProps {
	isToolStreaming?: boolean;
}

export const ThinkingMessage = ({ isToolStreaming }: ThinkingMessageProps) => {
	return (
		<motion.div
			className="w-full mx-auto max-w-3xl"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.2 }}
		>
			<div className="flex justify-center py-4">
				<span className="text-sm text-muted-foreground font-medium">
					{isToolStreaming ? "Running tools..." : "Loading chat..."}
				</span>
			</div>
		</motion.div>
	);
};