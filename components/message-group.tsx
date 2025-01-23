import { motion } from "framer-motion";
import { type MessageWithModel } from "./chat";

interface MessageGroupProps {
	messages: MessageWithModel[];
	renderMessage: (message: MessageWithModel) => React.ReactNode;
}

export function MessageGroup({ messages, renderMessage }: MessageGroupProps) {
	return (
		<motion.div
			className="message-group relative group"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
		>
			<div className="absolute left-8 top-0 bottom-0 w-px bg-border opacity-30 transition-opacity duration-200 group-hover:opacity-100" />
			<div className="relative z-10">
				{messages.map(message => renderMessage(message))}
			</div>
		</motion.div>
	);
} 