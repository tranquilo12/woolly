import { motion } from "framer-motion";
import { AvailableRepository, AVAILABLE_REPOSITORIES } from "@/lib/constants";

interface RepositoryMentionMenuProps {
	isOpen: boolean;
	searchTerm: string;
	onSelect: (repo: AvailableRepository) => void;
	position: {
		top: number;
		left: number;
		placement: 'above' | 'below';
	};
}

export function RepositoryMentionMenu({
	isOpen,
	searchTerm,
	onSelect,
	position,
}: RepositoryMentionMenuProps) {
	if (!isOpen) return null;

	const filteredRepos = AVAILABLE_REPOSITORIES.filter(repo =>
		repo.toLowerCase().includes(searchTerm.toLowerCase())
	);

	return (
		<motion.div
			initial={{ opacity: 0, y: position.placement === 'above' ? 10 : -10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: position.placement === 'above' ? 10 : -10 }}
			className="fixed z-50 w-64 bg-background border rounded-md shadow-lg max-h-[300px] overflow-y-auto"
			style={{
				top: `${position.top}px`,
				left: `${position.left}px`,
			}}
		>
			<div className="py-1">
				{filteredRepos.map((repo) => (
					<button
						key={repo}
						type="button"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onSelect(repo);
						}}
						className="w-full px-4 py-2 text-left hover:bg-accent/50 text-sm"
					>
						{repo}
					</button>
				))}
			</div>
		</motion.div>
	);
} 