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
				marginLeft: isSidebarOpen && isSidebarPinned ? "clamp(300px, 30%, 500px)" : "0",
				marginRight: isAgentOpen && isAgentPinned ? "clamp(400px, 35%, 800px)" : "0",
				transform: isAgentOpen && isAgentPinned
					? "translateX(calc(-1 * clamp(100px, 10%, 200px)))"
					: "translateX(0)",
				width: isAgentOpen && isAgentPinned
					? "calc(100% - clamp(400px, 35%, 800px))"
					: "100%",
			}}
		>
			{children}
		</motion.div>
	);
} 