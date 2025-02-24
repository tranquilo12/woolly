'use client';

import { motion } from "framer-motion";
import { useSidebar } from "./sidebar-provider";
import { useAgentPanel } from "./agent-panel/agent-provider";

interface ChatLayoutProps {
	children: React.ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
	const { isOpen: isSidebarOpen } = useSidebar();
	const { isOpen: isAgentOpen } = useAgentPanel();

	return (
		<motion.div
			className="relative flex-1 w-full"
		>
			{children}
		</motion.div>
	);
} 