'use client';

import { motion, AnimatePresence } from "framer-motion";
import { useAgentPanel } from "./agent-provider";
import { Pin, PinOff, MenuIcon } from "lucide-react";
import { Button } from "../ui/button";
import { useRef, RefObject } from "react";
import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/utils";
import { AgentContent } from "./agent-content";
import { usePathname } from 'next/navigation';

export function AgentPanel() {
	const { isOpen, toggle, setIsOpen, isPinned, setIsPinned } = useAgentPanel();
	const panelRef = useRef<HTMLDivElement>(null);
	const pathname = usePathname();

	// Extract chat ID from URL path
	const chatId = pathname?.split('/').pop() || '';

	useClickOutside(panelRef as RefObject<HTMLElement>, () => {
		if (isOpen && !isPinned) {
			setIsOpen(false);
		}
	});

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: { duration: 0.2 }
		},
		exit: {
			opacity: 0,
			transition: { duration: 0.15 }
		}
	};

	const contentVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: { delay: 0.1, duration: 0.2 }
		}
	};

	return (
		<div className="agent-panel-container relative">
			<AnimatePresence>
				{isOpen && (
					<motion.div
						ref={panelRef}
						initial="hidden"
						animate="visible"
						exit="exit"
						variants={containerVariants}
						className={cn(
							"fixed right-0 top-[var(--navbar-height)] z-40",
							"h-[calc(100vh-var(--navbar-height))]",
							"w-full sm:w-[400px]",
							"border-l border-border/50",
							"bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
						)}
					>
						<motion.div
							className="flex flex-col w-full h-full"
							variants={contentVariants}
							initial="hidden"
							animate="visible"
						>
							<AgentContent className="p-4" currentChatId={chatId} />
							<div className="absolute bottom-0 left-0 right-0 p-2 border-t border-border/50">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setIsPinned(!isPinned)}
									className={cn(
										"w-full flex items-center justify-start gap-2 px-2 hover:bg-muted/50",
										isPinned && "text-primary bg-muted/50"
									)}
								>
									{isPinned ? (
										<PinOff className="h-4 w-4" />
									) : (
										<Pin className="h-4 w-4" />
									)}
								</Button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
} 