"use client";

import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { RepositoryItem } from "./repository-item";
import { useEffect, useState } from "react";
import { AvailableRepository } from "@/lib/constants";
import { IndexingStatusPanel } from "./indexing-status-panel";

export function RepositoryList() {
	const {
		repositories,
		startIndexing,
		deleteIndex,
		subscribeToStatus,
		fetchAllRepositories,
		activeSSEConnections,
		setActiveSSEConnections,
	} = useRepositoryStatus();

	const [selectedRepo, setSelectedRepo] = useState<AvailableRepository | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleShowDetails = async (name: AvailableRepository) => {
		if (selectedRepo === name) {
			setSelectedRepo(null);
			return;
		}

		setIsLoading(true);
		setSelectedRepo(name);
		// Add small delay to ensure loading state is visible

		await new Promise(resolve => setTimeout(resolve, 100));
		setIsLoading(false);
	};

	useEffect(() => {
		fetchAllRepositories();
	}, [fetchAllRepositories]);

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
						onStartIndexing={startIndexing as (name: AvailableRepository) => void}
						onToggleWatch={(name, enabled) => {
							if (!enabled && activeSSEConnections[name]) {
								activeSSEConnections[name].close();
								setActiveSSEConnections(prev => {
									const next = { ...prev };
									delete next[name];
									return next;
								});
							} else if (enabled) {
								subscribeToStatus(name as AvailableRepository);
							}
						}}
						onShowDetails={() => handleShowDetails(repository.name as AvailableRepository)}
						isSelected={selectedRepo === repository.name}
					/>
					{selectedRepo === repository.name && (
						<IndexingStatusPanel
							repoName={repository.name}
							onClose={() => setSelectedRepo(null)}
							onDelete={deleteIndex}
							isLoading={isLoading}
						/>
					)}
				</div>
			))}
		</div>
	);
}
