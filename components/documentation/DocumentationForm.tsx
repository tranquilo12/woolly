import { useState } from 'react';
import { DocumentationState } from '@/types/documentation';
import { Button } from '../ui/button';
import { useChat } from 'ai/react';
import { useDocumentationPanel } from './documentation-panel-provider';
import { DocumentationSelector } from './DocumentationSelector';

export function DocumentationForm({ chatId }: { chatId: string }) {
	const { setIsOpen } = useDocumentationPanel();
	const [state, setState] = useState<DocumentationState>({
		isGenerating: false,
		selectedRepo: null,
		selectedFiles: [],
	});

	const handleRepoSelect = (repo: string | null) => {
		setState(prev => ({ ...prev, selectedRepo: repo }));
		if (repo) {
			setIsOpen(true); // Open panel when repo is selected
		}
	};

	// const { append } = useChat({
	// 	api: `/api/agents/${chatId}/documentation`,
	// 	body: {
	// 		repo_name: state.selectedRepo,
	// 		file_paths: state.selectedFiles,
	// 	},
	// });

	const handleGenerate = async () => {
		if (!state.selectedRepo) return;

		setState(prev => ({ ...prev, isGenerating: true }));
		try {
			console.log('Generating documentation for', state.selectedRepo);
		} catch (error) {
			console.error('Documentation generation failed:', error);
		} finally {
			setState(prev => ({ ...prev, isGenerating: false }));
		}
	};

	return (
		<div className="flex flex-col gap-4 p-4">
			<DocumentationSelector
				onSelect={handleRepoSelect}
				selectedRepo={state.selectedRepo}
				className="mb-2"
			/>
			<Button
				onClick={handleGenerate}
				disabled={!state.selectedRepo || state.isGenerating}
			>
				{state.isGenerating ? 'Generating...' : 'Generate Documentation'}
			</Button>
		</div>
	);
} 