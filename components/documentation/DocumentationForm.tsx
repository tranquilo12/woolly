import { useState, useCallback, useEffect } from 'react';
import { DocumentationState } from '@/types/documentation';
import { Button } from '../ui/button';
import { useDocumentationPanel } from './documentation-panel-provider';
import { DocumentationSelector } from './DocumentationSelector';
import { useDocumentationAgent } from '@/hooks/use-documentation-agent';
import { toast } from 'sonner';

export function DocumentationForm({ chatId }: { chatId: string }) {
	const { setIsOpen, setContent } = useDocumentationPanel();
	const [state, setState] = useState<DocumentationState>({
		isGenerating: false,
		isThinking: false,
		selectedRepo: null,
		selectedFiles: [],
		error: null,
		toolInvocations: []
	});

	const { initializeAgent, append: appendAgent, messages, isThinking } = useDocumentationAgent({
		chatId,
	});

	// Modify the useEffect to only handle content updates
	useEffect(() => {
		if (messages.length > 0) {
			const lastMessage = messages[messages.length - 1];
			if (lastMessage.role === 'assistant') {
				setContent(lastMessage.content || '');
				setState(prev => ({
					...prev,
					error: null,
					isStreaming: isThinking
				}));
			}
		}
	}, [messages, setContent, isThinking]);

	const handleGenerate = useCallback(async () => {
		if (!state.selectedRepo) return;

		setState(prev => ({
			...prev,
			isGenerating: true,
			error: null
		}));

		try {
			console.log('Starting documentation generation...');
			const agentId = await initializeAgent();
			console.log('Agent initialized:', agentId);

			await appendAgent({
				role: 'user',
				content: `Generate documentation for ${state.selectedRepo}`,
			}, {
				body: {
					repo_name: state.selectedRepo,
					file_paths: state.selectedFiles,
					agent_id: agentId
				}
			});
		} catch (error) {
			console.error('Documentation generation failed:', error);
			const errorMessage = error instanceof Error ? error.message : 'Documentation generation failed';
			setState(prev => ({ ...prev, error: errorMessage, isGenerating: false }));
			toast.error(errorMessage);
		} finally {
			setState(prev => ({ ...prev, isGenerating: false }));
		}
	}, [state.selectedRepo, state.selectedFiles, appendAgent, initializeAgent]);

	const handleRepoSelect = (repo: string | null) => {
		setIsOpen(true);
		setState(prev => ({ ...prev, selectedRepo: repo }));
	};

	return (
		<div className="flex flex-col gap-4 p-4">
			<DocumentationSelector
				onSelect={handleRepoSelect}
				selectedRepo={state.selectedRepo}
				className="mb-2"
				disabled={state.isGenerating}
			/>
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