import { motion } from "framer-motion";

interface TokenCountProps {
	prompt_tokens?: number;
	completion_tokens?: number;
	total_tokens?: number;
	isLoading?: boolean;
}

export const TokenCount = ({ prompt_tokens, completion_tokens, total_tokens, isLoading }: TokenCountProps) => {
	if (!prompt_tokens && !completion_tokens && !total_tokens && !isLoading) {
		return null;
	}

	return (
		<motion.div
			className="text-xs text-muted-foreground mt-2 flex gap-3"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.2 }}
		>
			{isLoading ? (
				<span className="animate-pulse">Calculating tokens...</span>
			) : (
				<>
					{prompt_tokens && <span>Prompt: {prompt_tokens}</span>}
					{completion_tokens && <span>Completion: {completion_tokens}</span>}
					{total_tokens && <span>Total: {total_tokens}</span>}
				</>
			)}
		</motion.div>
	);
}; 