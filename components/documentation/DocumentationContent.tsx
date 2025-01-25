import { memo } from 'react';
import { Markdown } from '../markdown';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface DocumentationContentProps {
	content: string;
	isLoading: boolean;
	isStreaming: boolean;
	error?: string | null;
}

export const DocumentationContent = memo(function DocumentationContent({
	content,
	isLoading,
	isStreaming,
	error
}: DocumentationContentProps) {
	if (error) {
		return (
			<div className="flex items-center justify-center h-full p-8 text-center text-destructive">
				<p className="text-sm">{error}</p>
			</div>
		);
	}

	return (
		<div className={cn(
			"prose prose-sm dark:prose-invert max-w-none w-full",
			"px-4 py-2 documentation-content overflow-auto relative"
		)}>
			{(isLoading || isStreaming) && (
				<div className="absolute top-2 right-2">
					<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
				</div>
			)}
			<Markdown>{content}</Markdown>
		</div>
	);
}); 