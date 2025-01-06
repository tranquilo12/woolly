"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRepositoryStatus, RepositoryStats } from "@/hooks/use-repository-status";
import { AvailableRepository } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Trash2, X, Loader2, RefreshCw } from "lucide-react";
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

const tableRowClass = "h-[42px] min-h-[42px]";

export function IndexingStatusPanel({
	repoName,
	onClose,
	onDelete,
	isLoading = false,
}: IndexingStatusPanelProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	const { repositories, startIndexing, getRepositoryStats } = useRepositoryStatus();
	const repository = repositories.find((repo) => repo.name === repoName);
	const [stats, setStats] = useState<RepositoryStats | null>(null);
	const [isStatsLoading, setIsStatsLoading] = useState(false);

	// Fetch stats when panel opens
	useEffect(() => {
		const fetchStats = async () => {
			if (!repository) return;
			setIsStatsLoading(true);
			try {
				const stats = await getRepositoryStats(repoName as AvailableRepository);
				setStats(stats);
			} catch (error) {
				console.error('Failed to fetch stats:', error);
			} finally {
				setIsStatsLoading(false);
			}
		};
		fetchStats();
	}, [repoName, repository, getRepositoryStats]);

	// Memoize the table content to prevent unnecessary re-renders
	const tableContent = useMemo(() => {
		if (isLoading) {
			return (
				<TableRow>
					<TableCell colSpan={2} className="text-center">Loading details...</TableCell>
				</TableRow>
			);
		}

		if (!repository) {
			return (
				<TableRow>
					<TableCell colSpan={2} className="text-center italic">Waiting for repository data...</TableCell>
				</TableRow>
			);
		}

		return (
			<>
				<TableRow className={tableRowClass}>
					<TableCell className="font-medium">Status</TableCell>
					<TableCell className="truncate-cell">{repository.indexing_status || '-'}</TableCell>
				</TableRow>
				<TableRow className={tableRowClass}>
					<TableCell className="font-medium">Message</TableCell>
					<TableCell className="truncate-cell">{repository.message || '-'}</TableCell>
				</TableRow>
				<TableRow className={tableRowClass}>
					<TableCell className="font-medium">Current File</TableCell>
					<TableCell className="truncate-cell">
						<span className="font-mono text-xs">{repository.current_file || '-'}</span>
					</TableCell>
				</TableRow>
				<TableRow className={tableRowClass}>
					<TableCell className="font-medium">Files Processed</TableCell>
					<TableCell className="truncate-cell">
						{repository.processed_count !== undefined ? `${repository.processed_count} / ${repository.total_files || '?'}` : '-'}
					</TableCell>
				</TableRow>
				<TableRow className={tableRowClass}>
					<TableCell className="font-medium">Progress</TableCell>
					<TableCell className="truncate-cell">
						{repository.progress !== undefined ? `${Math.round(repository.progress)}%` : '-'}
					</TableCell>
				</TableRow>
				<TableRow className={tableRowClass}>
					<TableCell className="font-medium">Collection</TableCell>
					<TableCell className="truncate-cell">{stats?.collection || '-'}</TableCell>
				</TableRow>
				<TableRow className={tableRowClass}>
					<TableCell className="font-medium">Total Points</TableCell>
					<TableCell className="truncate-cell">
						{stats?.total_points ? stats.total_points.toLocaleString() : '-'}
					</TableCell>
				</TableRow>
				<TableRow className={tableRowClass}>
					<TableCell className="font-medium">Language</TableCell>
					<TableCell className="truncate-cell">{repository.language || '-'}</TableCell>
				</TableRow>
				<TableRow className={tableRowClass}>
					<TableCell className="font-medium">Last Indexed</TableCell>
					<TableCell className="truncate-cell">
						{repository.last_indexed ? new Date(repository.last_indexed).toLocaleString() : '-'}
					</TableCell>
				</TableRow>
			</>
		);
	}, [
		isLoading,
		repository,
		stats,
		tableRowClass
	]);

	return (
		<motion.div
			layout={false}
			initial={{ height: 0, opacity: 0 }}
			animate={{ height: contentRef.current?.offsetHeight || 'auto', opacity: 1 }}
			exit={{ height: 0, opacity: 0 }}
			transition={{
				height: { duration: 0.2, ease: "easeInOut" },
				opacity: { duration: 0.15 }
			}}
			className="overflow-hidden border-x border-b border-border/50 rounded-b-md -mt-[1px] bg-background/95 backdrop-blur-sm"
			style={{ willChange: 'height' }}
		>
			<div ref={contentRef} className="p-4 space-y-4">
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => startIndexing(repoName)}
						disabled={repository?.indexing_status === 'in_progress'}
						className="flex-1"
					>
						{repository?.indexing_status === 'in_progress' ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
								Indexing...
							</>
						) : (
							'Start Indexing'
						)}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => startIndexing(repoName, true)}
						disabled={repository?.indexing_status === 'in_progress'}
						className="text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950/50"
					>
						<RefreshCw className="h-4 w-4" />
						Force
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

				<Table className="repository-table">
					<TableHeader>
						<TableRow>
							<TableHead>Property</TableHead>
							<TableHead>Value</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{tableContent}
					</TableBody>
				</Table>
			</div>
		</motion.div>
	);
}