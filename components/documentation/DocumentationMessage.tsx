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

// Verify renderers are properly imported
console.log("[DEBUG] Available renderers:", {
	SystemOverviewRenderer: !!SystemOverviewRenderer,
	ComponentAnalysisRenderer: !!ComponentAnalysisRenderer,
	CodeDocumentationRenderer: !!CodeDocumentationRenderer,
	APIOverviewRenderer: !!APIOverviewRenderer,
	DevelopmentGuideRenderer: !!DevelopmentGuideRenderer,
	MaintenanceOpsRenderer: !!MaintenanceOpsRenderer
});

// Add debug helper function
const debugContent = (content: any, label: string) => {
	console.log(`[DEBUG] ${label}:`, {
		contentType: typeof content,
		keys: content ? Object.keys(content) : [],
		hasComponentName: content?.component_name !== undefined,
		hasDescription: content?.description !== undefined,
		hasDependencies: content?.dependencies !== undefined,
		content: content
	});
};

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
		// Check if we have any valid tool invocations with results
		const validToolInvocation = toolInvocations?.find(tool =>
			tool.state === 'result' && (tool.args || tool.result)
		);
		// @ts-ignore
		parsedContent = validToolInvocation?.args || validToolInvocation?.result || null;
	} else {
		// Handle final result content
		// @ts-ignore
		parsedContent = finalResult.args || finalResult.result;
	}

	// Handle both string and object content
	if (typeof parsedContent === 'string') {
		try {
			parsedContent = JSON.parse(parsedContent);
		} catch (e) {
			// If parsing fails, we no longer handle Mermaid diagrams
			console.warn('Failed to parse content:', e);
			parsedContent = null;
		}
	} else if (parsedContent && typeof parsedContent === 'object') {
		// Handle nested content structure
		if ('args' in parsedContent) {
			parsedContent = parsedContent.args;
		}
		// Already in the correct format
	}

	// Enhanced debug logging
	console.log('Rendering message:', {
		id: message.id,
		parsedContent,
		rawContent: message.content,
		toolInvocations: toolInvocations?.map(t => ({
			toolName: t.toolName,
			state: t.state,
			hasArgs: !!t.args,
			// @ts-ignore
			hasResult: !!t.result
		}))
	});

	// Helper function to check if content matches a specific type
	const matchesContentType = (content: any, properties: string[]): boolean => {
		if (!content) return false;
		return properties.every(prop => prop in content);
	};

	// Determine the content type and render appropriate component
	const renderContent = (content: any) => {
		if (!content) {
			console.log("[DEBUG] Content is null or undefined");
			return null;
		}

		// Enhanced debug logging for content structure
		debugContent(content, "Rendering content structure");

		// Create a result variable to track if we've rendered something
		let renderedComponent = null;

		// Detect content type based on fields present, not step index
		// System overview check
		if (matchesContentType(content, ['architecture_diagram', 'core_technologies', 'design_patterns'])) {
			console.log("[DEBUG] Detected SystemOverview content, rendering SystemOverviewRenderer");
			try {
				// Check if system_requirements is missing and add it if needed
				const enhancedContent = { ...content };
				if (!enhancedContent.system_requirements) {
					console.log("[DEBUG] Adding missing system_requirements array");
					enhancedContent.system_requirements = [];
				}
				renderedComponent = <SystemOverviewRenderer content={enhancedContent} />;
			} catch (error) {
				console.error("[ERROR] Failed to render SystemOverviewRenderer:", error);
				// Fallback to JSON display on error
				renderedComponent = (
					<pre className="bg-muted p-4 rounded-lg overflow-auto">
						<code>{JSON.stringify(content, null, 2)}</code>
					</pre>
				);
			}
		}

		// If we've rendered a component, return it
		if (renderedComponent) {
			return renderedComponent;
		}

		// Continue with other content type checks
		// Code documentation check
		if (matchesContentType(content, ['code_module'])) {
			console.log("[DEBUG] Detected CodeDocumentation content");
			return <CodeDocumentationRenderer content={content} />;
		}

		// API overview check
		if (matchesContentType(content, ['authentication_methods', 'base_url'])) {
			console.log("[DEBUG] Detected APIOverview content");
			return <APIOverviewRenderer content={content} />;
		}

		// Component analysis check
		if (matchesContentType(content, ['component_name', 'description'])) {
			console.log("[DEBUG] Detected ComponentAnalysis content");
			// Add dependencies if missing
			const enhancedContent = { ...content };
			if (!enhancedContent.dependencies) {
				enhancedContent.dependencies = [];
			}
			debugContent(enhancedContent, "Component Analysis Content");
			return <ComponentAnalysisRenderer content={enhancedContent} />;
		}

		// Development guide check
		if (matchesContentType(content, ['workflow_documentation', 'setup_instructions'])) {
			console.log("[DEBUG] Detected DevelopmentGuide content");
			return <DevelopmentGuideRenderer content={content} />;
		}

		// Maintenance ops check
		if (matchesContentType(content, ['maintenance_procedures', 'troubleshooting_guide'])) {
			console.log("[DEBUG] Detected MaintenanceOps content");
			return <MaintenanceOpsRenderer content={content} />;
		}

		// Fallback to JSON display
		console.log("[DEBUG] No specific renderer matched, using fallback JSON display");
		return (
			<pre className="bg-muted p-4 rounded-lg overflow-auto">
				<code>{JSON.stringify(content, null, 2)}</code>
			</pre>
		);
	};

	return (
		<div className={cn("documentation-message space-y-6", className)}>
			{/* Try to render with specific renderer first */}
			{parsedContent && renderContent(parsedContent)}

			{/* If renderContent didn't produce output but we have parsedContent, show raw JSON */}
			{parsedContent && !renderContent(parsedContent) && (
				<div className="border border-yellow-500 p-4 rounded-lg">
					<div className="font-medium text-yellow-500 mb-2">Content detected but no renderer matched:</div>
					<pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
						<code>{JSON.stringify(parsedContent, null, 2)}</code>
					</pre>
				</div>
			)}

			{/* Fallback to raw content display if no parsedContent */}
			{!parsedContent && message.content && (
				<div className="prose dark:prose-invert">
					<Markdown>{message.content}</Markdown>
				</div>
			)}

			{/* Show tool invocations */}
			{(!parsedContent || !renderContent(parsedContent)) && toolInvocations?.map((tool: any, index: number) => (
				<div
					key={`${message.id}-${tool.toolCallId || 'tool'}-${index}`}
					className="opacity-100 transition-opacity duration-200"
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
	if ('core_technologies' in content) {
		if ('authentication_methods' in content) {
			return <APIOverviewRenderer content={content} />;
		}
		if ('design_patterns' in content && 'system_requirements' in content) {
			return <SystemOverviewRenderer content={content} />;
		}
	}

	if ('component_name' in content) {
		// Ensure dependencies exist
		const enhancedContent = { ...content };
		if (!enhancedContent.dependencies) {
			enhancedContent.dependencies = [];
		}
		return <ComponentAnalysisRenderer content={enhancedContent} />;
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