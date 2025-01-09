import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { INDEXER_BASE_URL, AVAILABLE_REPOSITORIES, AvailableRepository } from '@/lib/constants';
import { debounce } from 'lodash';

export interface Repository {
	name: string;
	needs_indexing: boolean;
	indexing_status?: string;
	changed_files?: string[];
	last_indexed?: number;
	indexed_files?: number;
	total_files?: number;
	watch_enabled?: boolean;
	processed_count?: number;
	progress?: number;
	message?: string;
	current_file?: string;
	file_stats?: {
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
	};
	stats?: RepositoryStats;
	language?: string;
	path?: string;
	index_stats?: {
		total_chunks: number;
		collection: string;
		has_index: boolean;
	};
}

export interface IndexingStatus {
	repository: string;
	status: string;
	message: string;
	progress?: number;
	current_file?: string;
	processed_count?: number;
	total_files?: number;
	file_stats?: Repository['file_stats'];
}

export interface RepositoryMap {
	name: string;
	total_files: number;
	languages: string[];
	symbols: {
		classes: number;
		functions: number;
		interfaces: number;
	};
}

export interface GitDiffOptions {
	repo_name: string;
	from_commit?: string;
	to_commit?: string;
	file_paths?: string[];
	ignore_whitespace?: boolean;
	context_lines?: number;
}

export interface RepositoryStats {
	repository: string;
	total_points: number;
	collection: string;
	indexing_status: string;
}

export interface RepositorySearchResult {
	content: string;
	chunk_type: string;
	file_path: string;
	start_line: number[];
	end_line: number[];
	score: number;
	repository: string;
}

export interface SearchRepositoryRequest {
	query: string;
	limit?: number;
	threshold?: number;
	file_paths?: string[];
	chunk_types?: string[];
}

export function useRepositoryStatus() {
	const [repositories, setRepositories] = useState<Repository[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [activeSSEConnections, setActiveSSEConnections] = useState<{ [key: string]: EventSource }>({});
	const [indexingProgress, setIndexingProgress] = useState<{ [key: string]: number }>({});
	const [currentStatus, setCurrentStatus] = useState<{ [key: string]: string }>({});

	// Fetch repository statuses for all known repos
	const fetchAllRepositories = useCallback(async () => {
		setIsLoading(true);
		try {
			const summaries = await Promise.all(
				AVAILABLE_REPOSITORIES.map(async (repoName) => {
					const response = await fetch(`${INDEXER_BASE_URL}/indexer/status/${repoName}`);
					if (!response.ok) throw new Error(`Failed to fetch status for ${repoName}`);
					const status = await response.json();

					return {
						name: repoName,
						needs_indexing: status.status === 'not_indexed',
						indexing_status: status.status,
						current_file: status.current_file,
						total_files: status.total_files,
						processed_count: status.processed_count,
						processed_files: status.processed_files || [],
						progress: status.total_files
							? (status.processed_count / status.total_files) * 100
							: 0,
						status:
							status.status === 'in_progress'
								? 'indexing'
								: status.status === 'error'
									? 'error'
									: 'idle',
						message: status.message,
					};
				})
			);

			setRepositories(summaries as Repository[]);
		} catch (error) {
			console.error('Failed to fetch repositories:', error);
			toast.error('Failed to load repositories');
		} finally {
			setIsLoading(false);
		}
	}, []); // Added empty dependencies array as second argument

	const debouncedSetRepositories = debounce((updateFn: (prev: Repository[]) => Repository[]) => {
		setRepositories(updateFn);
	}, 100);

	// Subscribe to SSE for a given repository
	const subscribeToStatus = useCallback(
		async (repoName: AvailableRepository) => {
			if (activeSSEConnections[repoName]) {
				activeSSEConnections[repoName].close();
			}

			const eventSource = new EventSource(
				`${INDEXER_BASE_URL}/indexer/sse?repo=${repoName}`
			);

			eventSource.addEventListener("indexing_status", (event) => {
				const data = JSON.parse(event.data);

				// Batch all state updates together
				const updates = {
					repositories: (prev: Repository[]) =>
						prev.map((repo) =>
							repo.name === repoName
								? {
									...repo,
									indexing_status: data.status,
									current_file: data.current_file,
									total_files: data.total_files,
									processed_count: data.processed_count,
									progress: data.total_files
										? (data.processed_count / data.total_files) * 100
										: 0,
									file_stats: data.file_stats,
									message: data.message,
									watch_enabled: true
								}
								: repo
						),
					progress: data.total_files
						? (data.processed_count / data.total_files) * 100
						: 0,
					status: data.status
				};

				// Use a single RAF call to batch updates
				requestAnimationFrame(() => {
					debouncedSetRepositories(updates.repositories);
					setIndexingProgress((prev) => ({
						...prev,
						[repoName]: updates.progress
					}));
					setCurrentStatus((prev) => ({
						...prev,
						[repoName]: updates.status
					}));
				});
			});

			eventSource.onerror = () => {
				eventSource.close();
				setActiveSSEConnections((prev) => {
					const next = { ...prev };
					delete next[repoName];
					return next;
				});
			};

			setActiveSSEConnections((prev) => ({
				...prev,
				[repoName]: eventSource
			}));
		},
		[activeSSEConnections, debouncedSetRepositories]
	);

	// Start indexing for a given repository and automatically subscribe to SSE
	const startIndexing = useCallback(
		async (repoName: AvailableRepository, force: boolean = false) => {
			try {
				// Close any existing SSE connection first
				if (activeSSEConnections[repoName]) {
					activeSSEConnections[repoName].close();
				}

				const response = await fetch(`${INDEXER_BASE_URL}/indexer/${repoName}${force ? '?force=true' : ''}`, {
					method: 'POST',
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.detail || 'Failed to start indexing');
				}

				// Subscribe to status updates after re-start
				subscribeToStatus(repoName);

				const data = await response.json();
				toast.success(data.message || `Started ${force ? 'force ' : ''}indexing ${repoName}`);

				// Update repository status
				setRepositories((prev) =>
					prev.map((repo) =>
						repo.name === repoName
							? {
								...repo,
								indexing_status: 'in_progress',
								progress: 0,
								current_file: undefined,
								processed_count: 0,
								total_files: undefined,
								file_stats: undefined
							}
							: repo
					)
				);
			} catch (error) {
				console.error('Failed to start indexing:', error);
				toast.error(
					`Failed to start indexing ${repoName}: ${error instanceof Error ? error.message : 'Unknown error'}`
				);
			}
		},
		[subscribeToStatus, setRepositories, activeSSEConnections]
	);

	// Cleanup SSE on unmount
	useEffect(() => {
		return () => {
			Object.values(activeSSEConnections).forEach((es) => es.close());
		};
	}, [activeSSEConnections]);

	// ▶ Automatically fetch repositories on initial mount
	useEffect(() => {
		fetchAllRepositories().catch((error) => {
			console.error('Initial fetch repositories call failed:', error);
		});
	}, [fetchAllRepositories]);

	// Additional hooks for retrieving data
	const getRepositoryMap = useCallback(async (repoName: string): Promise<RepositoryMap> => {
		try {
			const response = await fetch(`${INDEXER_BASE_URL}/repo-map/${repoName}`);
			if (!response.ok) throw new Error('Failed to fetch repository map');
			return await response.json();
		} catch (error) {
			console.error('Failed to fetch repository map:', error);
			toast.error('Failed to load repository structure');
			throw error;
		}
	}, []);

	const getRepositorySummary = useCallback(async (repoName: string) => {
		try {
			const response = await fetch(`${INDEXER_BASE_URL}/repo-map/${repoName}/summary`);
			if (!response.ok) throw new Error('Failed to fetch repository summary');
			return await response.json();
		} catch (error) {
			console.error('Failed to fetch repository summary:', error);
			toast.error('Failed to load repository summary');
			throw error;
		}
	}, []);

	const getGitDiff = useCallback(async (options: GitDiffOptions) => {
		try {
			const response = await fetch(`${INDEXER_BASE_URL}/git/diff`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(options),
			});
			if (!response.ok) throw new Error('Failed to fetch git diff');
			const data = await response.json();
			return data.diff;
		} catch (error) {
			console.error('Failed to fetch git diff:', error);
			toast.error('Failed to load git diff');
			throw error;
		}
	}, []);

	const deleteIndex = useCallback(async (repoName: AvailableRepository) => {
		try {
			const response = await fetch(`${INDEXER_BASE_URL}/indexer/${repoName}`, {
				method: 'DELETE',
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.detail || 'Failed to delete index');
			}

			toast.success(`Deleted index for ${repoName}`);

			// Update repository status
			setRepositories((prev) =>
				prev.map((repo) =>
					repo.name === repoName
						? {
							...repo,
							indexing_status: 'not_indexed',
							progress: 0,
							current_file: undefined,
							processed_count: 0,
							total_files: undefined,
							file_stats: undefined
						}
						: repo
				)
			);
		} catch (error) {
			console.error('Failed to delete index:', error);
			toast.error(
				`Failed to delete index for ${repoName}: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}, [setRepositories]);

	const getRepositoryStats = useCallback(async (repoName: AvailableRepository) => {
		try {
			const response = await fetch(`${INDEXER_BASE_URL}/indexer/${repoName}/stats`);
			if (!response.ok) throw new Error('Failed to fetch repository statistics');
			return await response.json();
		} catch (error) {
			console.error('Failed to fetch repository statistics:', error);
			toast.error('Failed to load repository statistics');
			throw error;
		}
	}, []);

	const searchRepository = useCallback(async (repoName: AvailableRepository, options: SearchRepositoryRequest) => {
		const response = await fetch(`${INDEXER_BASE_URL}/indexer/${repoName}/search`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(options),
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.detail || 'Failed to search repository');
		}

		return response.json();
	}, []);

	return {
		repositories,
		setRepositories,
		isLoading,
		setIsLoading,
		activeSSEConnections,
		setActiveSSEConnections,
		getRepositoryMap,
		getRepositorySummary,
		getGitDiff,
		fetchAllRepositories,
		startIndexing,
		subscribeToStatus,
		indexingProgress,
		setIndexingProgress,
		currentStatus,
		setCurrentStatus,
		deleteIndex,
		getRepositoryStats,
		searchRepository,
	};
} 