import { memo } from 'react';
import { Card } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";

export const CodeDocumentationRenderer = memo(function CodeDocumentationRenderer({ content }: { content: any }) {
	return (
		<Card className="p-4 space-y-4">
			<h3 className="text-lg font-semibold">{content.code_module}</h3>
			<p className="text-muted-foreground">{content.description}</p>

			<div className="space-y-2">
				<h4 className="font-medium">Usage Examples</h4>
				{content.usage_examples.map((example: string, i: number) => (
					<div key={i} className="bg-muted p-2 rounded">
						<Markdown>{example}</Markdown>
					</div>
				))}
			</div>
		</Card>
	);
}); 