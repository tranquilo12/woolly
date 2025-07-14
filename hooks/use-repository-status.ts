import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { BACKEND_URL, Repository } from '@/lib/constants';
import { debounce } from 'lodash';

interface RepositoryResponse {
	success: boolean;
	repositories: Repository[];
	total_repositories: number;
	total_chunks: number;
	error?: string;
}

export function useRepositoryStatus() {
	const [repositories, setRepositories] = useState<Repository[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

	const fetchRepositories = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch('/api/mcp/repositories');
			const data: RepositoryResponse = await response.json();

			if (!response.ok || !data.success) {
				throw new Error(data.error || 'Failed to fetch repositories');
			}

			setRepositories(data.repositories);
			setLastUpdated(new Date());
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to fetch repositories';
			setError(errorMessage);
			toast.error(`Repository Status Error: ${errorMessage}`);
		} finally {
			setLoading(false);
		}
	}, []);

	const debouncedFetch = useMemo(
		() => debounce(fetchRepositories, 300),
		[fetchRepositories]
	);

	useEffect(() => {
		fetchRepositories();

		// Poll for updates every 30 seconds
		const interval = setInterval(fetchRepositories, 30000);

		return () => {
			clearInterval(interval);
			debouncedFetch.cancel();
		};
	}, [fetchRepositories, debouncedFetch]);

	const refreshRepositories = useCallback(() => {
		debouncedFetch();
	}, [debouncedFetch]);

	const startIndexing = useCallback(async (repositoryName: string) => {
		try {
			const response = await fetch('/api/mcp/repositories', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					action: 'start_indexing',
					repository_name: repositoryName,
				}),
			});

			const data = await response.json();

			if (!response.ok || !data.success) {
				throw new Error(data.error || 'Failed to start indexing');
			}

			toast.success(`Indexing started for ${repositoryName}`);

			// Refresh repositories after starting indexing
			setTimeout(refreshRepositories, 1000);

			return data;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to start indexing';
			toast.error(`Indexing Error: ${errorMessage}`);
			throw err;
		}
	}, [refreshRepositories]);

	const repositoryStats = useMemo(() => {
		const total = repositories.length;
		const indexed = repositories.filter(repo => repo.indexing_status === 'completed').length;
		const indexing = repositories.filter(repo => repo.indexing_status === 'indexing').length;
		const totalChunks = repositories.reduce((sum, repo) => sum + (repo.indexed_files || 0), 0);

		return {
			total,
			indexed,
			indexing,
			needsIndexing: total - indexed - indexing,
			totalChunks,
			completionRate: total > 0 ? (indexed / total) * 100 : 0
		};
	}, [repositories]);

	const getRepositoryByName = useCallback((name: string) => {
		return repositories.find(repo => repo.name === name);
	}, [repositories]);

	const isRepositoryIndexed = useCallback((name: string) => {
		const repo = getRepositoryByName(name);
		return repo?.indexing_status === 'completed';
	}, [getRepositoryByName]);

	return {
		repositories,
		loading,
		error,
		lastUpdated,
		repositoryStats,
		refreshRepositories,
		startIndexing,
		getRepositoryByName,
		isRepositoryIndexed,
	};
} 