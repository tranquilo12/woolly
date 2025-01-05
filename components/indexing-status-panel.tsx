"use client";

import React, { useEffect, useState } from "react";
import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { AvailableRepository } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2, X, Loader2 } from "lucide-react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface FileStats {
	current?: {
		total_lines: number;
		processed_lines: number;
		total_tokens: number;
		processed_tokens: number;
		total_bytes?: number;
		processed_bytes?: number;
		status: string;
	};
	processed?: Array<{
		path: string;
		stats: {
			total_lines: number;
			processed_lines: number;
			total_tokens: number;
			processed_tokens: number;
			total_bytes?: number;
			processed_bytes?: number;
			status: string;
		};
	}>;
}

interface IndexingStatusPanelProps {
	repoName: AvailableRepository;
	onClose?: () => void;
	onDelete?: (name: AvailableRepository) => void;
	isLoading?: boolean;
}

export function IndexingStatusPanel({
	repoName,
	onClose,
	onDelete,
	isLoading = false,
}: IndexingStatusPanelProps) {
	const { repositories, startIndexing, subscribeToStatus } = useRepositoryStatus();
	const repository = repositories.find((repo) => repo.name === repoName);
	const [fileStats, setFileStats] = useState<FileStats | null>(null);

	useEffect(() => {
		if (repository?.file_stats) {
			setFileStats(repository.file_stats);
		}
	}, [repository?.file_stats]);

	useEffect(() => {
		return () => {
			if (repository?.indexing_status === 'in_progress') {
				subscribeToStatus(repoName);
			}
		};
	}, [repoName, repository?.indexing_status, subscribeToStatus]);

	if (isLoading) {
		return (
			<div className="w-full flex flex-col border border-border/50 p-4 rounded-md">
				<div className="text-sm text-foreground">Loading details...</div>
			</div>
		);
	}

	if (!repository) {
		return (
			<div className="w-full flex flex-col border border-border/50 p-4 rounded-md">
				<div className="text-sm italic">Waiting for repository data...</div>
			</div>
		);
	}

	const {
		indexing_status: status,
		message,
		progress,
		current_file: currentFile,
		processed_count: processedCount,
		total_files: totalFiles,
	} = repository;

	return (
		<div className="w-full flex flex-col border border-border/50 p-4 rounded-md gap-4">
			<div className="flex justify-between items-center">
				<h2 className="font-semibold text-lg">{repoName}</h2>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => startIndexing(repoName)}
						disabled={status === 'in_progress'}
					>
						{status === 'in_progress' ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
								Indexing...
							</>
						) : (
							'Start Indexing'
						)}
					</Button>
					{onDelete && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => onDelete(repoName)}
							className="text-destructive hover:text-destructive"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					)}
					{onClose && (
						<Button variant="ghost" size="sm" onClick={onClose}>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
			</div>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-[200px]">Property</TableHead>
						<TableHead>Value</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell className="font-medium">Status</TableCell>
						<TableCell className="flex justify-between items-center">
							{status}
						</TableCell>
					</TableRow>
					{message && (
						<TableRow>
							<TableCell className="font-medium">Message</TableCell>
							<TableCell>{message}</TableCell>
						</TableRow>
					)}
					{currentFile && (
						<TableRow>
							<TableCell className="font-medium">Current File</TableCell>
							<TableCell>
								<span className="font-mono text-xs">{currentFile}</span>
							</TableCell>
						</TableRow>
					)}
					{processedCount !== undefined && totalFiles !== undefined && (
						<TableRow>
							<TableCell className="font-medium">Progress</TableCell>
							<TableCell>
								<div className="space-y-2">
									<div>{processedCount} / {totalFiles} files</div>
									{progress !== undefined && (
										<div className="h-2 bg-muted/20 rounded">
											<div
												className="h-full bg-blue-500 transition-all duration-500"
												style={{ width: `${progress}%` }}
											/>
										</div>
									)}
								</div>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>

			{fileStats?.current && (
				<div className="space-y-2">
					<h3 className="font-semibold text-sm">Current File Statistics</h3>
					<Table>
						<TableBody>
							<TableRow>
								<TableCell className="font-medium">Lines</TableCell>
								<TableCell>
									{fileStats.current.processed_lines} / {fileStats.current.total_lines}
								</TableCell>
							</TableRow>
							<TableRow>
								<TableCell className="font-medium">Tokens</TableCell>
								<TableCell>
									{fileStats.current.processed_tokens} / {fileStats.current.total_tokens}
								</TableCell>
							</TableRow>
							{fileStats.current.total_bytes && (
								<TableRow>
									<TableCell className="font-medium">Bytes</TableCell>
									<TableCell>
										{fileStats.current.processed_bytes} / {fileStats.current.total_bytes}
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
					<div className="h-1.5 bg-muted/20 rounded">
						<div
							className="h-full bg-blue-500/50 transition-all duration-500"
							style={{
								width: `${(fileStats.current.processed_lines / fileStats.current.total_lines) * 100}%`
							}}
						/>
					</div>
				</div>
			)}

			{fileStats?.processed && fileStats.processed.length > 0 && (
				<div className="space-y-2">
					<h3 className="font-semibold text-sm">Recently Processed Files</h3>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>File</TableHead>
								<TableHead>Statistics</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{fileStats.processed.slice(-5).map((file, idx) => (
								<TableRow key={idx}>
									<TableCell className="font-mono text-xs truncate">
										{file.path}
									</TableCell>
									<TableCell className="text-xs text-muted-foreground">
										{file.stats.total_lines} lines, {file.stats.total_tokens} tokens
										{file.stats.total_bytes && `, ${file.stats.total_bytes} bytes`}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
} 