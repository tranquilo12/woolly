import { memo } from 'react';
import { Card } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";

export const MaintenanceOpsRenderer = memo(function MaintenanceOpsRenderer({ content }: { content: any }) {
	return (
		<Card className="p-4 space-y-4">
			<h3 className="text-lg font-semibold">Maintenance & Operations</h3>

			<div className="prose dark:prose-invert">
				<h4 className="font-medium">Maintenance Procedures</h4>
				<Markdown>{content.maintenance_procedures}</Markdown>
			</div>

			<div className="prose dark:prose-invert">
				<h4 className="font-medium">Troubleshooting Guide</h4>
				<Markdown>{content.troubleshooting_guide}</Markdown>
			</div>
		</Card>
	);
}); 