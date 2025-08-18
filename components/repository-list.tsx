"use client";

import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { RepositoryItem } from "./repository-item";
import { useEffect, useState, useCallback } from "react";
import { AvailableRepository } from "@/lib/constants";
import { IndexingStatusPanel } from "./indexing-status-panel";
import { AnimatePresence } from "framer-motion";

export function RepositoryList() {
	const {
		repositories,
		startIndexing,
		refreshRepositories,
	} = useRepositoryStatus();

	const [selectedRepo, setSelectedRepo] = useState<AvailableRepository | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleShowDetails = (name: AvailableRepository) => {
		if (selectedRepo === name) {
			setSelectedRepo(null);
			return;
		}
		setSelectedRepo(name);
	};

	useEffect(() => {
		refreshRepositories();
	}, [refreshRepositories]);

	const handleDelete = (repoName: string) => {
		// Delete functionality would be implemented here
		console.log('Delete repository:', repoName);
	};

	if (!repositories.length) {
		return (
			<div className="text-sm text-muted-foreground italic">
				No repositories found
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{repositories.map((repository) => (
				<div key={repository.name} className="space-y-4">
					<RepositoryItem
						repository={repository}
						onStartIndexing={startIndexing}
						onShowDetails={() => handleShowDetails(repository.name as AvailableRepository)}
						isSelected={selectedRepo === repository.name}
					/>
					<AnimatePresence initial={false} mode="sync">
						{selectedRepo === repository.name && (
							<IndexingStatusPanel
								repoName={repository.name}
								onClose={() => setSelectedRepo(null)}
								onDelete={handleDelete}
								isLoading={isLoading}
							/>
						)}
					</AnimatePresence>
				</div>
			))}
		</div>
	);
}
