import { motion } from "framer-motion";
import { AvailableRepository } from "@/lib/constants";
import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { cn } from "@/lib/utils";

interface RepositoryMentionMenuProps {
	isOpen: boolean;
	searchTerm: string;
	onSelect: (repo: AvailableRepository) => void;
	position: {
		top: number;
		left: number;
		placement: 'above' | 'below';
	};
	selectedIndex: number;
}

export function RepositoryMentionMenu({
	isOpen,
	searchTerm,
	onSelect,
	position,
	selectedIndex,
}: RepositoryMentionMenuProps) {
	const { repositories } = useRepositoryStatus();

	if (!isOpen) return null;

	const filteredRepos = repositories
		.map(repo => repo.name)
		.filter(repo => repo.toLowerCase().includes(searchTerm.toLowerCase()));

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
				{filteredRepos.map((repo, index) => (
					<button
						key={repo}
						type="button"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onSelect(repo);
						}}
						className={cn(
							"w-full px-4 py-2 text-left hover:bg-accent/50 text-sm",
							selectedIndex === index && "bg-accent/50"
						)}
					>
						{repo}
					</button>
				))}
			</div>
		</motion.div>
	);
} 