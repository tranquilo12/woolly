import { memo } from 'react';
import { MessageWithModel } from "../chat";
import { Markdown } from "../markdown";
import { cn } from "@/lib/utils";
import { APIOverviewRenderer } from "./renderers/APIOverviewRenderer";
import { SystemOverviewRenderer } from "./renderers/SystemOverviewRenderer";
import { ComponentAnalysisRenderer } from "./renderers/ComponentAnalysisRenderer";
import { MaintenanceOpsRenderer } from "./renderers/MaintenanceOpsRenderer";
import { DevelopmentGuideRenderer } from "./renderers/DevelopmentGuideRenderer";
import { ToolInvocationDisplay } from "../tool-invocation";
import { CodeDocumentationRenderer } from "./renderers/CodeDocumentationRenderer";
import { MermaidWrapper } from "./renderers/shared/MermaidWrapper";

interface DocumentationMessageProps {
	message: MessageWithModel;
	className?: string;
}

export const DocumentationMessage = memo(function DocumentationMessage({
	message,
	className
}: DocumentationMessageProps) {
	// Standardize tool invocations handling
	const toolInvocations = message.tool_invocations || message.toolInvocations;

	// Get the final result tool invocation
	const finalResult = toolInvocations?.find(tool =>
		tool.toolName === 'final_result' && tool.state === 'result'
	);

	// Parse content from tool result or message content
	let parsedContent = null;
	if (!finalResult) {
		console.warn('No final result found in tool invocations');
		parsedContent = { ...message.toolInvocations };
	} else {
		parsedContent = { ...finalResult.args }; // Create a shallow copy using spread operator
	}

	// Handle both string and object content
	if (typeof parsedContent === 'string') {
		try {
			parsedContent = JSON.parse(parsedContent);
		} catch (e) {
			// If parsing fails, check if it contains a Mermaid diagram
			if (parsedContent.includes('```mermaid')) {
				const mermaidContent = parsedContent
					.split('```mermaid')
					.pop()
					?.split('```')[0]
					?.trim();

				if (mermaidContent) {
					return (
						<div className={cn("documentation-message space-y-4", className)}>
							<MermaidWrapper content={mermaidContent} />
						</div>
					);
				}
			}
			console.warn('Failed to parse content:', e);
			parsedContent = null;
		}
	} else if (parsedContent?.args?.architecture_diagram) {
		// Handle nested content structure
		parsedContent = parsedContent.args;
	}

	// Debug logging
	console.log('Rendering message:', {
		id: message.id,
		content: parsedContent,
		toolInvocations,
		messageContent: message.content
	});

	// Helper function to check if content matches a specific type
	const matchesContentType = (content: any, properties: string[]): boolean => {
		return properties.every(prop => prop in content);
	};

	// Determine the content type and render appropriate component
	const renderContent = (content: any) => {
		if (!content) return null;

		// Code documentation check
		if (matchesContentType(content, ['code_module', 'description', 'usage_examples'])) {
			return <CodeDocumentationRenderer content={content} />;
		}

		// System overview check
		if (matchesContentType(content, ['architecture_diagram', 'core_technologies'])) {
			if ('authentication_methods' in content) {
				return <APIOverviewRenderer content={content} />;
			}
			return <SystemOverviewRenderer content={content} />;
		}

		// Component analysis check
		if (matchesContentType(content, ['component_name', 'description'])) {
			return <ComponentAnalysisRenderer content={content} />;
		}

		// Development guide check
		if (matchesContentType(content, ['workflow_documentation'])) {
			return <DevelopmentGuideRenderer content={content} />;
		}

		// Maintenance ops check
		if (matchesContentType(content, ['maintenance_procedures', 'troubleshooting_guide'])) {
			return <MaintenanceOpsRenderer content={content} />;
		}

		// If no specific type matches, return null to fall through to default rendering
		return null;
	};

	return (
		<div className={cn("documentation-message space-y-6 mt-6", className)}>
			{/* Try to render with specific renderer first */}
			{renderContent(parsedContent)}

			{/* Fallback to raw content display if no specific renderer matched */}
			{(!parsedContent || !renderContent(parsedContent)) && message.content && (
				<div className="prose dark:prose-invert">
					<Markdown>{message.content}</Markdown>
				</div>
			)}

			{/* Show tool invocations */}
			{(!parsedContent || !renderContent(parsedContent)) && toolInvocations?.map((tool: any, index: number) => (
				<div
					key={`${message.id}-${tool.toolCallId || 'tool'}-${index}`}
					className="opacity-0 animate-in fade-in duration-200"
				>
					<ToolInvocationDisplay
						toolInvocation={{
							id: tool.toolCallId,
							toolCallId: tool.toolCallId,
							toolName: tool.toolName,
							args: tool.args,
							state: tool.state,
							result: 'result' in tool ? tool.result : undefined
						}}
					/>
				</div>
			))}
		</div>
	);
});

const DocumentationRenderer = memo(function DocumentationRenderer({ content }: { content: any }) {
	// Detect content type and use appropriate renderer
	if ('architecture_diagram' in content && 'core_technologies' in content) {
		if ('authentication_methods' in content) {
			return <APIOverviewRenderer content={content} />;
		}
		return <SystemOverviewRenderer content={content} />;
	}

	if ('component_name' in content) {
		return <ComponentAnalysisRenderer content={content} />;
	}

	if ('maintenance_procedures' in content) {
		return <MaintenanceOpsRenderer content={content} />;
	}

	if ('workflow_documentation' in content) {
		return <DevelopmentGuideRenderer content={content} />;
	}

	// Fallback to JSON display
	return (
		<pre className="bg-muted p-4 rounded-lg overflow-auto">
			<code>{JSON.stringify(content, null, 2)}</code>
		</pre>
	);
}); 