'use client';

import { motion } from "framer-motion";
import { useSidebar } from "./sidebar-provider";

interface ChatLayoutProps {
	children: React.ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
	const { isOpen, isPinned } = useSidebar();

	return (
		<motion.div
			className="relative flex-1 w-full transition-all duration-300 ease-in-out"
			animate={{
				marginLeft: isOpen && isPinned ? "400px" : "0",
			}}
		>
			{children}
		</motion.div>
	);
} 