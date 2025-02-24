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
import { isAPIOverview, isSystemOverview, isComponentAnalysis, isDevelopmentGuide, isMaintenanceOps } from "@/types/documentation";

interface DocumentationMessageProps {
	message: MessageWithModel;
	className?: string;
}

export const DocumentationMessage = memo(function DocumentationMessage({
	message,
	className
}: DocumentationMessageProps) {
	// Only look for final_result tool invocations
	const finalResult = message.toolInvocations?.find(tool =>
		tool.toolName === 'final_result' && tool.state === 'result'
	);

	// Parse content from tool result or message content
	let parsedContent = finalResult?.args || message.content;
	if (typeof parsedContent === 'string') {
		try {
			parsedContent = JSON.parse(parsedContent);
		} catch (e) {
			parsedContent = null;
		}
	}

	return (
		<div className={cn("documentation-message space-y-4", className)}>
			{parsedContent && typeof parsedContent === 'object' && (
				<>
					{isAPIOverview(parsedContent) && (
						<APIOverviewRenderer content={parsedContent} />
					)}
					{isSystemOverview(parsedContent) && (
						<SystemOverviewRenderer content={parsedContent} />
					)}
					{isComponentAnalysis(parsedContent) && (
						<ComponentAnalysisRenderer content={parsedContent} />
					)}
					{isDevelopmentGuide(parsedContent) && (
						<DevelopmentGuideRenderer content={parsedContent} />
					)}
					{isMaintenanceOps(parsedContent) && (
						<MaintenanceOpsRenderer content={parsedContent} />
					)}
				</>
			)}

			{/* Only show raw content if no documentation content was found */}
			{(!parsedContent || typeof parsedContent !== 'object') && (
				<div className="prose dark:prose-invert">
					<Markdown>{message.content}</Markdown>
				</div>
			)}

			{/* Only show tool invocations if we're not showing documentation content */}
			{(!parsedContent || typeof parsedContent !== 'object') && message.toolInvocations?.map((tool: any, index: number) => (
				<ToolInvocationDisplay
					key={`${message.id}-${tool.toolCallId || 'tool'}-${index}`}
					toolInvocation={{
						id: tool.toolCallId,
						toolCallId: tool.toolCallId,
						toolName: tool.toolName,
						args: tool.args,
						state: tool.state,
						result: 'result' in tool ? tool.result : undefined
					}}
				/>
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