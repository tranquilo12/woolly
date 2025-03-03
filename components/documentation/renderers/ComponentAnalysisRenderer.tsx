import { memo } from 'react';
import { Card } from "@/components/ui/card";
import { ComponentAnalysis } from '@/types/documentation';

interface ComponentAnalysisRendererProps {
	content: ComponentAnalysis;
}

export const ComponentAnalysisRenderer = memo(function ComponentAnalysisRenderer({
	content
}: ComponentAnalysisRendererProps) {
	return (
		<div className="opacity-100 transition-opacity duration-200">
			<Card className="p-6 space-y-6 dark:bg-zinc-900 border-zinc-800">
				<h3 className="text-lg font-semibold">{content.component_name}</h3>

				<div className="space-y-2">
					<h4 className="font-medium">Description</h4>
					<p className="text-sm">{content.description}</p>
				</div>

				<div className="space-y-2">
					<h4 className="font-medium">Dependencies</h4>
					{Array.isArray(content.dependencies) && content.dependencies.length > 0 ? (
						<ul className="list-disc pl-4">
							{content.dependencies.map((dep, i) => (
								<li key={i} className="text-sm">{dep}</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-muted-foreground">No dependencies</p>
					)}
				</div>
			</Card>
		</div>
	);
}); 