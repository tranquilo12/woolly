'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface MermaidDiagramProps {
	content: string;
	className?: string;
}

export function MermaidDiagram({ content, className }: MermaidDiagramProps) {
	const [svg, setSvg] = useState<string>('');
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const renderDiagram = async () => {
			if (!content) {
				console.warn('MermaidDiagram: No content provided');
				setError('No diagram content provided');
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
				setError(null);

				const diagramId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

				// Enhanced content cleaning
				let cleanContent = content;

				// If content is wrapped in code blocks, extract it
				if (content.includes('```')) {
					const matches = content.match(/```(?:mermaid)?([\s\S]*?)```/);
					cleanContent = matches ? matches[1].trim() : content;
				}

				// Remove any "mermaid" text at the start
				cleanContent = cleanContent
					.replace(/^mermaid\s+/i, '')
					.trim();

				// Ensure the content starts with a valid diagram type
				if (!cleanContent.match(/^(graph|sequenceDiagram|classDiagram|flowchart|erDiagram)/)) {
					if (cleanContent.includes('-->')) {
						// If it contains arrows but no diagram type, assume it's a graph
						cleanContent = `graph TD\n${cleanContent}`;
					}
				}

				// Remove any BOM or special characters
				cleanContent = cleanContent
					.replace(/[\u200B-\u200D\uFEFF]/g, '')
					.replace(/^\s+|\s+$/gm, '');

				console.log('Rendering mermaid diagram with content:', cleanContent);

				// Configure mermaid for this render
				mermaid.initialize({
					startOnLoad: true,
					theme: 'dark',
					securityLevel: 'loose',
					fontFamily: 'inherit',
					logLevel: 'error',
					flowchart: {
						curve: 'basis',
						defaultRenderer: 'dagre-d3'
					}
				});

				// Validate the diagram syntax
				await mermaid.parse(cleanContent);

				// Render the diagram
				const { svg } = await mermaid.render(diagramId, cleanContent);
				setSvg(svg);
			} catch (err) {
				console.error('Failed to render mermaid diagram:', err, 'Content:', content);
				setError(err instanceof Error ? err.message : 'Failed to render diagram');
			} finally {
				setIsLoading(false);
			}
		};

		renderDiagram();
	}, [content]);

	if (isLoading) {
		return <Skeleton className="w-full h-48" />;
	}

	if (error) {
		return (
			<div className="text-destructive text-sm p-4 bg-destructive/10 rounded-lg">
				Failed to render diagram: {error}
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className={cn("mermaid-diagram overflow-auto rounded-lg bg-muted p-4", className)}
			dangerouslySetInnerHTML={{ __html: svg }}
		/>
	);
} 