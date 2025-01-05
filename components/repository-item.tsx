"use client";

import { motion } from "framer-motion";
import { Repository } from "@/hooks/use-repository-status";
import { AvailableRepository } from "@/lib/constants";

interface RepositoryItemProps {
	repository: Repository;
	onStartIndexing: (name: string) => void;
	onToggleWatch: (name: string, enabled: boolean) => void;
	onShowDetails: (name: string) => void;
	indexingProgress?: number;
	currentStatus?: string;
}

export function RepositoryItem({
	repository,
	onShowDetails,
	currentStatus
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
				className="relative rounded-md hover:bg-muted/50 group/item"
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
		</motion.div>
	);
}