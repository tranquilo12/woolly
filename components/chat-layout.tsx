'use client';

import { motion } from "framer-motion";
import { useSidebar } from "./sidebar-provider";
import { useAgentPanel } from "./agent-panel/agent-provider";

interface ChatLayoutProps {
	children: React.ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
	const { isOpen: isSidebarOpen, isPinned: isSidebarPinned } = useSidebar();
	const { isOpen: isAgentOpen, isPinned: isAgentPinned } = useAgentPanel();

	return (
		<motion.div
			className="relative flex-1 w-full transition-all duration-300 ease-in-out"
			animate={{
				marginLeft: isSidebarOpen && isSidebarPinned ? "400px" : "0",
				marginRight: isAgentOpen && isAgentPinned ? "400px" : "0",
			}}
		>
			{children}
		</motion.div>
	);
} 