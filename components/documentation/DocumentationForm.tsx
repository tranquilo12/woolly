import { useState } from 'react';
import { DocumentationState } from '@/types/documentation';
import { Button } from '../ui/button';
import { useChat } from 'ai/react';

export function DocumentationForm({ chatId }: { chatId: string }) {
	const [state, setState] = useState<DocumentationState>({
		isGenerating: false,
		selectedRepo: null,
		selectedFiles: [],
	});

	const { append } = useChat({
		api: `/api/agents/${chatId}/documentation`,
		body: {
			repo_name: state.selectedRepo,
			file_paths: state.selectedFiles,
		},
	});

	const handleGenerate = async () => {
		if (!state.selectedRepo) return;

		setState(prev => ({ ...prev, isGenerating: true }));
		try {
			await append({
				role: 'system',
				content: `Generate documentation for ${state.selectedRepo}`,
			});
		} catch (error) {
			console.error('Documentation generation failed:', error);
		} finally {
			setState(prev => ({ ...prev, isGenerating: false }));
		}
	};

	return (
		<div className="flex flex-col gap-4 p-4">
			{/* We'll add repository and file selection UI here in the next step */}
			<Button
				onClick={handleGenerate}
				disabled={!state.selectedRepo || state.isGenerating}
			>
				{state.isGenerating ? 'Generating...' : 'Generate Documentation'}
			</Button>
		</div>
	);
} 