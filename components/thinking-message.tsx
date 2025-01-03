import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SparklesIcon, WrenchIcon } from "lucide-react";

interface ThinkingMessageProps {
	isToolStreaming?: boolean;
}

export const ThinkingMessage = ({ isToolStreaming }: ThinkingMessageProps) => {
	const role = "assistant";

	return (
		<motion.div
			className="w-full mx-auto max-w-3xl px-4 group/message "
			initial={{ y: 5, opacity: 0 }}
			animate={{ y: 0, opacity: 1, transition: { delay: 0.3 } }}
			data-role={role}
		>
			<div
				className={cn(
					"flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl",
					{
						"group-data-[role=user]/message:bg-muted": true,
					},
				)}
			>
				<div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
					{isToolStreaming ? <WrenchIcon size={14} /> : <SparklesIcon size={14} />}
				</div>

				<div className="flex flex-col gap-2 w-full">
					<div className="flex flex-col gap-4 text-muted-foreground">
						{isToolStreaming ? "Running tools..." : "Thinking..."}
					</div>
				</div>
			</div>
		</motion.div>
	);
};