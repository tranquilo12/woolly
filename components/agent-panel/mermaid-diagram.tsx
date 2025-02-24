'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface MermaidDiagramProps {
	content: string;
	className?: string;
}

mermaid.initialize({
	startOnLoad: true,
	theme: 'dark',
	securityLevel: 'loose',
	fontFamily: 'inherit',
});

export function MermaidDiagram({ content, className }: MermaidDiagramProps) {
	const [svg, setSvg] = useState<string>('');
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const renderDiagram = async () => {
			if (!content) return;

			try {
				setIsLoading(true);
				setError(null);

				// Clean and prepare the content
				const cleanContent = content.trim().replace(/\\n/g, '\n');

				const { svg } = await mermaid.render('mermaid-diagram', cleanContent);
				setSvg(svg);
			} catch (err) {
				console.error('Failed to render mermaid diagram:', err);
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