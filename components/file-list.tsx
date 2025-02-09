"use client";

import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { File } from "lucide-react";

interface FileListProps {
	repoName: string;
}

export function FileList({ repoName }: FileListProps) {
	const { repositories } = useRepositoryStatus();
	const repository = repositories.find(repo => repo.name === repoName);

	if (!repository || !repository.file_stats) {
		return (
			<div className="text-sm text-muted-foreground italic p-4">
				No files available
			</div>
		);
	}

	return (
		<div className="space-y-1">
			{repository.file_stats.processed?.map((file, index) => (
				<div
					key={index}
					className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/50 rounded-sm"
				>
					<File size={14} className="text-muted-foreground" />
					<span className="font-mono text-xs truncate">
						{file.path.split('/').pop()}
					</span>
				</div>
			))}
		</div>
	);
} 