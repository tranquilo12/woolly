import { memo } from 'react';
import { Card } from "@/components/ui/card";

export const ComponentAnalysisRenderer = memo(function ComponentAnalysisRenderer({ content }: { content: any }) {
	return (
		<Card className="p-4 space-y-4">
			<h3 className="text-lg font-semibold">{content.component_name}</h3>

			<p className="text-muted-foreground">{content.description}</p>

			<div className="space-y-2">
				<h4 className="font-medium">Dependencies</h4>
				<ul className="list-disc pl-4">
					{content.dependencies.map((dep: string, i: number) => (
						<li key={i} className="text-sm">{dep}</li>
					))}
				</ul>
			</div>
		</Card>
	);
}); 