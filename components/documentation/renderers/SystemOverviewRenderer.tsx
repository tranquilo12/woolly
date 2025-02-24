import { memo } from 'react';
import { Card } from "@/components/ui/card";
import { MermaidDiagram } from "@/components/agent-panel/mermaid-diagram";
import { SystemOverview } from '@/types/documentation';

interface SystemOverviewRendererProps {
	content: SystemOverview;
}

export const SystemOverviewRenderer = memo(function SystemOverviewRenderer({
	content
}: SystemOverviewRendererProps) {
	return (
		<Card className="p-4 space-y-4">
			<h3 className="text-lg font-semibold">System Overview</h3>

			<div className="space-y-2">
				<h4 className="font-medium">Architecture</h4>
				<MermaidDiagram content={content.architecture_diagram} />
			</div>

			<div className="space-y-2">
				<h4 className="font-medium">Core Technologies</h4>
				<ul className="list-disc pl-4">
					{content.core_technologies.map((tech, i) => (
						<li key={i}>{tech}</li>
					))}
				</ul>
			</div>

			<div className="space-y-2">
				<h4 className="font-medium">Design Patterns</h4>
				<ul className="list-disc pl-4">
					{content.design_patterns.map((pattern, i) => (
						<li key={i}>{pattern}</li>
					))}
				</ul>
			</div>

			<div className="space-y-2">
				<h4 className="font-medium">Project Structure</h4>
				<pre className="bg-muted p-2 rounded">
					<code>{content.project_structure}</code>
				</pre>
			</div>
		</Card>
	);
}); 