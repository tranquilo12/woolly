import { memo } from 'react';
import { Markdown } from '../markdown';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface DocumentationContentProps {
	content: string;
	isLoading: boolean;
	error?: string | null;
}

export const DocumentationContent = memo(function DocumentationContent({
	content,
	isLoading,
	error
}: DocumentationContentProps) {
	if (error) {
		return (
			<div className="flex items-center justify-center h-full p-8 text-center text-destructive">
				<p className="text-sm">{error}</p>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full p-8">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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