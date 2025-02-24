import { memo } from 'react';
import { MermaidDiagram } from "@/components/agent-panel/mermaid-diagram";
import { cn } from "@/lib/utils";

interface MermaidWrapperProps {
	content: string;
	title?: string;
	className?: string;
}

export const MermaidWrapper = memo(function MermaidWrapper({
	content,
	title,
	className
}: MermaidWrapperProps) {
	// Clean the content if needed
	const cleanContent = content
		.replace(/^```mermaid\n/, '')
		.replace(/\n```$/, '')
		.trim();

	return (
		<div className={cn("space-y-2", className)}>
			{title && <h4 className="font-medium">{title}</h4>}
			<div className="rounded-lg overflow-hidden">
				<MermaidDiagram content={cleanContent} />
			</div>
		</div>
	);
}); 