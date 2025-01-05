"use client";

import React from "react";
import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { AvailableRepository } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Trash2, X, Loader2 } from "lucide-react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";

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
	const { repositories, startIndexing } = useRepositoryStatus();
	const repository = repositories.find((repo) => repo.name === repoName);

	if (isLoading) {
		return (
			<div className="text-sm text-foreground p-4 border border-border/50 rounded-md">
				Loading details...
			</div>
		);
	}

	if (!repository) {
		return (
			<div className="text-sm italic p-4 border border-border/50 rounded-md">
				Waiting for repository data...
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
		file_stats: fileStats,
	} = repository;

	return (
		<motion.div
			initial={{ height: 0, opacity: 0 }}
			animate={{ height: "auto", opacity: 1 }}
			exit={{ height: 0, opacity: 0 }}
			transition={{ duration: 0.2 }}
			className="overflow-hidden border-x border-b border-border/50 rounded-b-md -mt-[1px] bg-background/95 backdrop-blur-sm"
		>
			<div className="p-4 space-y-4">
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => startIndexing(repoName)}
						disabled={status === 'in_progress'}
						className="flex-1"
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
							className="text-destructive hover:text-destructive hover:bg-destructive/10"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					)}
					{onClose && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onClose}
							className="hover:bg-muted/50"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>

				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Property</TableHead>
							<TableHead>Value</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow>
							<TableCell className="font-medium">Status</TableCell>
							<TableCell>{status}</TableCell>
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
			</div>
		</motion.div>
	);
} 