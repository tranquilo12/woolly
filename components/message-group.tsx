import { motion } from "framer-motion";
import { type MessageWithModel } from "./chat";

interface MessageGroupProps {
	messages: MessageWithModel[];
	renderMessage: (message: MessageWithModel, isOrphaned?: boolean) => React.ReactNode;
}

export function MessageGroup({ messages, renderMessage }: MessageGroupProps) {
	// Check if this is an orphaned user message (single user message with no assistant response)
	const isOrphanedGroup = messages.length === 1 && messages[0].role === 'user';

	console.log('MessageGroup:', {
		messageCount: messages.length,
		isOrphanedGroup,
		firstMessageRole: messages[0]?.role
	}); // Debug log

	return (
		<motion.div className="message-group">
			{messages.map(message => renderMessage(message, isOrphanedGroup))}
		</motion.div>
	);
} 