import { memo } from 'react';
import { Markdown } from '../markdown';
import { cn } from '@/lib/utils';

interface DocumentationContentProps {
	content: string;
	isLoading?: boolean;
}

export const DocumentationContent = memo(function DocumentationContent({
	content,
	isLoading
}: DocumentationContentProps) {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full p-8">
				<span className="text-sm text-muted-foreground loading-pulse">
					Generating documentation...
				</span>
			</div>
		);
	}

	if (!content) {
		return null;
	}

	return (
		<div className={cn(
			"prose prose-sm dark:prose-invert max-w-none w-full",
			"px-4 py-2 documentation-content overflow-auto"
		)}>
			<Markdown>{content}</Markdown>
		</div>
	);
}); 