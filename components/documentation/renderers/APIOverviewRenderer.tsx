import { memo } from 'react';
import { Card } from "@/components/ui/card";
import { MermaidDiagram } from "@/components/agent-panel/mermaid-diagram";
import { Badge } from "@/components/ui/badge";

export const APIOverviewRenderer = memo(function APIOverviewRenderer({ content }: { content: any }) {
	return (
		<Card className="p-4 space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">{content.title}</h3>
				<Badge variant="outline">v{content.version}</Badge>
			</div>

			<p className="text-muted-foreground">{content.description}</p>

			<div className="space-y-2">
				<h4 className="font-medium">Architecture</h4>
				<MermaidDiagram content={content.architecture_diagram} />
			</div>

			<div className="grid md:grid-cols-2 gap-4">
				<div className="space-y-2">
					<h4 className="font-medium">Authentication Methods</h4>
					<ul className="list-disc pl-4">
						{content.authentication_methods.map((method: string, i: number) => (
							<li key={i}>{method}</li>
						))}
					</ul>
				</div>

				<div className="space-y-2">
					<h4 className="font-medium">Core Technologies</h4>
					<ul className="list-disc pl-4">
						{content.core_technologies.map((tech: string, i: number) => (
							<li key={i}>{tech}</li>
						))}
					</ul>
				</div>
			</div>

			{content.rate_limits && (
				<div className="space-y-2">
					<h4 className="font-medium">Rate Limits</h4>
					<div className="grid grid-cols-2 gap-2">
						{Object.entries(content.rate_limits).map(([endpoint, limit]) => (
							<div key={endpoint} className="flex justify-between p-2 bg-muted rounded">
								<span className="font-mono text-sm">{endpoint}</span>
								<span className="text-sm text-muted-foreground">{limit as string}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</Card>
	);
}); 