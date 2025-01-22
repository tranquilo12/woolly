import { useState, useCallback, useEffect } from 'react';
import { DocumentationState } from '@/types/documentation';
import { Button } from '../ui/button';
import { useDocumentationPanel } from './documentation-panel-provider';
import { DocumentationSelector } from './DocumentationSelector';
import { useDocumentationAgent } from '@/hooks/use-documentation-agent';
import { toast } from 'sonner';
import { ToolInvocationDisplay } from '../tool-invocation';

export function DocumentationForm({ chatId }: { chatId: string }) {
	const { setIsOpen, setContent } = useDocumentationPanel();
	const [state, setState] = useState<DocumentationState>({
		isGenerating: false,
		selectedRepo: null,
		selectedFiles: [],
		error: null,
		toolInvocations: []
	});

	const handleToolInvocation = useCallback((invocation: any) => {
		setState(prev => ({
			...prev,
			toolInvocations: [...prev.toolInvocations, invocation]
		}));
	}, []);

	const { initializeAgent, append, messages, isThinking } = useDocumentationAgent({
		chatId,
	});

	useEffect(() => {
		if (messages.length > 0) {
			const lastMessage = messages[messages.length - 1];
			if (lastMessage.role === 'assistant') {
				setContent(lastMessage.content);
				setState(prev => ({ ...prev, error: null }));
			}
		}
	}, [messages, setContent]);

	const handleRepoSelect = useCallback((repo: string | null) => {
		setState(prev => ({ ...prev, selectedRepo: repo }));
		if (repo) {
			setIsOpen(true);
		}
	}, [setIsOpen]);

	const handleGenerate = useCallback(async () => {
		if (!state.selectedRepo) return;

		setState(prev => ({
			...prev,
			isGenerating: true,
			error: null,
			toolInvocations: []
		}));

		try {
			const agentId = await initializeAgent();
			await append({
				role: 'user',
				content: `Generate documentation for ${state.selectedRepo}`,
			}, {
				body: {
					repo_name: state.selectedRepo,
					file_paths: state.selectedFiles,
				}
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Documentation generation failed';
			setState(prev => ({ ...prev, error: errorMessage }));
			toast.error(errorMessage);
		} finally {
			setState(prev => ({ ...prev, isGenerating: false }));
		}
	}, [state.selectedRepo, state.selectedFiles, append, initializeAgent]);

	return (
		<div className="flex flex-col gap-4 p-4">
			<DocumentationSelector
				onSelect={handleRepoSelect}
				selectedRepo={state.selectedRepo}
				className="mb-2"
				disabled={state.isGenerating}
			/>
			{state.toolInvocations.map((invocation, index) => (
				<ToolInvocationDisplay key={index} toolInvocation={invocation} />
			))}
			<Button
				onClick={handleGenerate}
				disabled={!state.selectedRepo || state.isGenerating}
				className="relative"
			>
				{state.isGenerating ? (
					<span className="flex items-center gap-2">
						<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						{isThinking ? 'Generating...' : 'Initializing...'}
					</span>
				) : (
					'Generate Documentation'
				)}
			</Button>
		</div>
	);
}