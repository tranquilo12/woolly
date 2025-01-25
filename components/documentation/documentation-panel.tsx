'use client';

import { motion } from 'framer-motion';
import { FileText, X } from 'lucide-react';
import { Button } from '../ui/button';
import { DocumentationContent } from './DocumentationContent';
import { DocumentationForm } from './DocumentationForm';
import { useDocumentationAgent } from '@/hooks/use-documentation-agent';
import { useDocumentationPanel } from './documentation-panel-provider';
import { cn } from '@/lib/utils';

interface DocumentationPanelProps {
	chatId: string;
}

const contentVariants = {
	hidden: { opacity: 0, x: 20 },
	visible: { opacity: 1, x: 0 }
};

export function DocumentationPanel({ chatId }: DocumentationPanelProps) {
	const { isOpen, setIsOpen, content } = useDocumentationPanel();
	const { isThinking } = useDocumentationAgent({ chatId });

	if (!isOpen) return null;

	return (
		<div className={cn(
			"fixed top-[var(--navbar-height)]",
			"h-[calc(100vh-var(--navbar-height))]",
			"ml-[calc(50%+24rem)] right-4", // Position relative to chat max-width
			"w-[min(600px,calc(100vw-50%-26rem))]", // Responsive width
			"bg-background border-l border-border shadow-lg",
			"transition-all duration-200 ease-in-out",
			"z-50" // Ensure it's above other content
		)}>
			<motion.div
				className="flex flex-col w-full h-full"
				variants={contentVariants}
				initial="hidden"
				animate="visible"
			>
				<div className="w-full flex-1 flex flex-col items-center gap-4 p-4">
					<div className="flex items-center justify-between w-full">
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
						{!content ? (
							<div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
								<FileText className="w-12 h-12 mb-4 opacity-50" />
								<p className="text-sm">Select a repository and generate documentation to see it here.</p>
							</div>
						) : (
							<DocumentationContent
								content={content}
								isLoading={false}
								isStreaming={isThinking}
							/>
						)}
						<DocumentationForm chatId={chatId} />
					</div>
				</div>
			</motion.div>
		</div>
	);
}