'use client';

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDocumentationPanel } from "./documentation-panel-provider";
import { useClickOutside } from '@/hooks/use-click-outside';
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Pin, PinOff, X, FileText } from "lucide-react";
import { DocumentationForm } from "./DocumentationForm";
import { DocumentationContent } from './DocumentationContent';

interface DocumentationPanelProps {
	chatId: string;
}

export function DocumentationPanel({ chatId }: DocumentationPanelProps) {
	const { isOpen, setIsOpen, isPinned, setIsPinned } = useDocumentationPanel();
	const panelRef = useRef<HTMLDivElement>(null);
	const [content, setContent] = useState('');

	useEffect(() => {
		console.log('Documentation Panel State:', { isOpen, isPinned });
	}, [isOpen, isPinned]);

	useClickOutside(panelRef as React.RefObject<HTMLElement>, () => {
		if (isOpen && !isPinned) {
			setIsOpen(false);
		}
	});

	const containerVariants = {
		hidden: { opacity: 0, x: "100%" },
		visible: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: "100%" }
	};

	const contentVariants = {
		hidden: { opacity: 0 },
		visible: { opacity: 1 }
	};

	return (
		<div className="documentation-panel-container relative">
			<AnimatePresence>
				{isOpen && (
					<motion.div
						ref={panelRef}
						initial="hidden"
						animate="visible"
						exit="exit"
						variants={containerVariants}
						className={cn(
							"fixed right-0 top-[var(--navbar-height)] z-[100] flex h-[calc(100vh-var(--navbar-height))] w-full items-start justify-center sm:w-[400px]",
							"bg-gradient-to-b from-blue-50/10 to-blue-100/10 dark:from-blue-900/10 dark:to-blue-950/10",
							"backdrop-blur-sm border-l border-border/50"
						)}
						data-documentation-panel
					>
						<motion.div
							className="flex flex-col w-full h-[calc(100vh-var(--navbar-height))] px-4 gap-4"
							variants={contentVariants}
							initial="hidden"
							animate="visible"
						>
							<div className="w-full flex-1 flex flex-col items-center gap-4">
								<div className="flex items-center justify-between w-full pt-4">
									<h2 className="text-lg font-semibold text-foreground">Documentation</h2>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setIsOpen(false)}
										className="hover:bg-muted/50"
									>
										<X className="h-4 w-4" />
									</Button>
								</div>

								<div className="w-full flex-1 overflow-auto documentation-scroll rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm">
									{!content? (
										<div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
											<FileText className="w-12 h-12 mb-4 opacity-50" />
											<p className="text-sm">Select a repository and generate documentation to see it here.</p>
										</div>
									) : (
										<DocumentationContent content={content} isLoading={false} />
									)}
									<DocumentationForm chatId={chatId} />
								</div>

								<div className="p-2 border-t border-border/50 mt-auto w-full">
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
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}