import { useState } from 'react';
import { Button } from '../ui/button';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRepositoryStatus } from '@/hooks/use-repository-status';
import { useDocumentationPanel } from './documentation-panel-provider';

interface DocumentationSelectorProps {
	onSelect: (repo: string | null) => void;
	selectedRepo: string | null;
	className?: string;
	disabled?: boolean;
}

export function DocumentationSelector({
	onSelect,
	selectedRepo,
	className,
	disabled
}: DocumentationSelectorProps) {
	const { repositories } = useRepositoryStatus();
	const [isOpen, setIsOpen] = useState(false);
	const { setIsOpen: setDocPanelOpen } = useDocumentationPanel();

	const handleRepoSelect = (repoName: string) => {
		onSelect(repoName);
		setIsOpen(false);
		setDocPanelOpen(true);
	};

	return (
		<div className={cn("relative", className)}>
			<Button
				variant="outline"
				size="sm"
				className={cn(
					"w-[160px] h-7 text-xs gap-2",
					"bg-background hover:bg-accent/50 transition-colors",
					"flex items-center justify-between px-3",
					selectedRepo && "bg-accent/50"
				)}
				onClick={() => setIsOpen(!isOpen)}
			>
				<span className="flex items-center gap-2 min-w-0">
					<BookOpen size={12} />
					<span className="truncate">
						{selectedRepo ? selectedRepo : 'Generate Documentation'}
					</span>
				</span>
			</Button>

			{isOpen && !disabled && (
				<div className="absolute bottom-full mb-1 w-[200px] z-50 bg-background border rounded-md shadow-lg">
					<div className="py-1">
						{repositories.map((repo) => (
							<button
								key={repo.name}
								className={cn(
									"w-full px-3 py-2 text-left text-xs",
									"hover:bg-accent/50 transition-colors",
									selectedRepo === repo.name && "bg-accent/50"
								)}
								onClick={() => handleRepoSelect(repo.name)}
							>
								{repo.name}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
} 