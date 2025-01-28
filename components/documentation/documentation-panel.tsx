'use client';

import { motion } from 'framer-motion';
import { FileText, X } from 'lucide-react';
import { Button } from '../ui/button';
import { DocumentationContent } from './DocumentationContent';
import { DocumentationSelector } from './DocumentationSelector';
import { useDocumentationAgent } from '@/hooks/use-documentation-agent';
import { useDocumentationPanel } from './documentation-panel-provider';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { ToolInvocationDisplay } from '../tool-invocation';
import { toast } from 'sonner';

interface DocumentationPanelProps {
	chatId: string;
}

const contentVariants = {
	hidden: { opacity: 0, x: 20 },
	visible: { opacity: 1, x: 0 }
};

export function DocumentationPanel({ chatId }: DocumentationPanelProps) {
	const { isOpen, setIsOpen, content, setContent } = useDocumentationPanel();
	const {
		isThinking,
		isLoading,
		messages,
		initializeAgent,
		append: appendAgent
	} = useDocumentationAgent({ chatId });

	const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);

	// Get the latest message's tool invocations
	const currentToolInvocations = messages[messages.length - 1]?.toolInvocations || [];

	const handleGenerate = async () => {
		if (!selectedRepo || isGenerating) return;

		setIsGenerating(true);
		try {
			await appendAgent({
				role: 'user',
				content: `Generate documentation for ${selectedRepo}`,
			}, {
				body: {
					repo_name: selectedRepo,
				}
			});
		} catch (error) {
			console.error('Documentation generation failed:', error);
			toast.error('Failed to generate documentation');
		} finally {
			setIsGenerating(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className={cn(
			"fixed top-[var(--navbar-height)]",
			"h-[calc(100vh-var(--navbar-height))]",
			"ml-[calc(50%+24rem)] right-4",
			"w-[min(600px,calc(100vw-50%-26rem))]",
			"bg-background border-l border-border shadow-lg",
			"transition-all duration-200 ease-in-out",
			"z-50"
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
						<div className="p-4 border-b border-border/50">
							<DocumentationSelector
								onSelect={(repo) => setSelectedRepo(repo)}
								selectedRepo={selectedRepo}
								disabled={isGenerating}
							/>
							<Button
								onClick={handleGenerate}
								disabled={!selectedRepo || isGenerating}
								className="w-full mt-4"
							>
								{isGenerating ? (
									<span className="flex items-center gap-2">
										<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
										{isThinking ? 'Generating...' : 'Initializing...'}
									</span>
								) : (
									'Generate Documentation'
								)}
							</Button>
						</div>

						{currentToolInvocations.map((tool) => (
							<ToolInvocationDisplay
								key={tool.toolCallId}
								toolInvocation={{
									id: tool.toolCallId,
									...tool
								}}
							/>
						))}

						{content ? (
							<DocumentationContent
								content={content}
								isLoading={isLoading}
								isStreaming={isThinking}
							/>
						) : !isGenerating && (
							<div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
								<FileText className="w-12 h-12 mb-4 opacity-50" />
								<p className="text-sm">Select a repository and generate documentation to see it here.</p>
							</div>
						)}
					</div>
				</div>
			</motion.div>
		</div>
	);
}