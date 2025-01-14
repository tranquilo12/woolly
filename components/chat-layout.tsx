'use client';

import { motion } from "framer-motion";
import { useSidebar } from "./sidebar-provider";
import { useDocumentationPanel } from "./documentation/documentation-panel-provider";
import { DocumentationPanel } from "./documentation/documentation-panel";
import { Button } from "./ui/button";

interface ChatLayoutProps {
	children: React.ReactNode;
	chatId?: string;
}

export function ChatLayout({ children, chatId }: ChatLayoutProps) {
	const { isOpen: isSidebarOpen, isPinned: isSidebarPinned } = useSidebar();
	const { isOpen: isDocOpen, isPinned: isDocPinned, setIsOpen: setDocOpen } = useDocumentationPanel();

	// Debug function
	const handleDebugToggle = () => {
		console.log('Debug: Attempting to toggle documentation panel');
		setDocOpen(true);
	};

	return (
		<>
			<motion.div
				className="relative flex-1 w-full transition-all duration-300 ease-in-out"
				animate={{
					marginLeft: isSidebarOpen && isSidebarPinned ? "400px" : "0",
					marginRight: isDocOpen && isDocPinned ? "400px" : "0",
				}}
			>
				{children}
				{chatId && <DocumentationPanel chatId={chatId} />}
			</motion.div>
		</>
	);
} 