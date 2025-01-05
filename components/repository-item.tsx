"use client";

import { motion } from "framer-motion";
import { Repository } from "@/hooks/use-repository-status";
import { AvailableRepository } from "@/lib/constants";

interface RepositoryItemProps {
	repository: Repository;
	onStartIndexing: (name: AvailableRepository) => void;
	onToggleWatch: (name: string, enabled: boolean) => void;
	onShowDetails: (name: string) => void;
	indexingProgress?: number;
	currentStatus?: string;
	isSelected?: boolean;
}

export function RepositoryItem({
	repository,
	onShowDetails,
	currentStatus,
	isSelected = false
}: RepositoryItemProps) {
	const itemVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				duration: 0.2
			}
		}
	};

	return (
		<motion.div
			className="group relative"
			variants={itemVariants}
		>
			<div
				onClick={() => onShowDetails(repository.name)}
				className={`relative rounded-t-md hover:bg-muted/50 group/item ${isSelected
						? 'bg-background/95 backdrop-blur-sm border-x border-t border-border/50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.2)]'
						: ''
					}`}
			>
				<div className="flex items-center justify-center min-h-[44px] w-full px-3 py-2">
					<span className="text-sm text-center truncate px-8">{repository.name}</span>
					{currentStatus && (
						<span className="text-xs text-muted-foreground ml-2">
							{currentStatus}
						</span>
					)}
				</div>
			</div>
			{isSelected && (
				<div className="absolute -bottom-2 left-0 right-0 h-2 bg-background z-10" />
			)}
		</motion.div>
	);
}