import { motion } from "framer-motion";
import { type MessageWithModel } from "./chat";

interface MessageGroupProps {
	messages: MessageWithModel[];
	renderMessage: (message: MessageWithModel) => React.ReactNode;
}

export function MessageGroup({ messages, renderMessage }: MessageGroupProps) {
	return (
		<motion.div className="message-group">
			{messages.map(message => renderMessage(message))}
		</motion.div>
	);
} 