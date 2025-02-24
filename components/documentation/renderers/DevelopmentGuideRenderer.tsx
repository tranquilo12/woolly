import { memo } from 'react';
import { Card } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";

export const DevelopmentGuideRenderer = memo(function DevelopmentGuideRenderer({ content }: { content: any }) {
	return (
		<Card className="p-4 space-y-4">
			<h3 className="text-lg font-semibold">Development Guide</h3>

			<div className="prose dark:prose-invert">
				<h4 className="font-medium">Setup Instructions</h4>
				<Markdown>{content.setup_instructions}</Markdown>
			</div>

			<div className="prose dark:prose-invert">
				<h4 className="font-medium">Workflow Documentation</h4>
				<Markdown>{content.workflow_documentation}</Markdown>
			</div>
		</Card>
	);
}); 