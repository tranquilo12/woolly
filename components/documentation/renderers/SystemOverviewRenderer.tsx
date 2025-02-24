import { memo } from 'react';
import { motion } from 'framer-motion';
import { Card } from "@/components/ui/card";
import { SystemOverview } from '@/types/documentation';
import { MermaidWrapper } from './shared/MermaidWrapper';

interface SystemOverviewRendererProps {
	content: SystemOverview;
}

export const SystemOverviewRenderer = memo(function SystemOverviewRenderer({
	content
}: SystemOverviewRendererProps) {
	return (
		<div className="opacity-0 animate-in fade-in duration-200">
			<Card className="p-6 space-y-6">
				<h3 className="text-lg font-semibold">System Overview</h3>

				<MermaidWrapper
					title="Architecture"
					content={content.architecture_diagram}
				/>

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
		</div>
	);
}); 