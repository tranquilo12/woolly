// Server-side MCP service to bridge cursor MCP tools with Next.js API routes
// This service uses the actual MCP tools to fetch real repository data

export interface MCPRepository {
	name: string;
	needs_indexing: boolean;
	indexing_status: string;
	indexed_files: number;
	total_files: number;
	last_indexed: number;
	progress: number;
	chunks?: number;
}

export interface MCPRepositoryResponse {
	success: boolean;
	repositories: MCPRepository[];
	total_repositories: number;
	total_chunks: number;
	error?: string;
}

export class MCPService {
	/**
	 * Fetch repositories from MCP server using actual cursor MCP tools
	 */
	static async getRepositories(): Promise<MCPRepositoryResponse> {
		try {
			// Use the actual MCP tool to get repository list
			const mcpResult = await fetch('/api/mcp/list-repositories', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ random_string: 'get_repos' })
			});

			if (!mcpResult.ok) {
				throw new Error(`MCP API call failed: ${mcpResult.status}`);
			}

			const mcpData = await mcpResult.json();

			// Parse the MCP response
			const repositories = this.parseMCPRepositoryResponse(mcpData.result);

			return {
				success: true,
				repositories,
				total_repositories: repositories.length,
				total_chunks: repositories.reduce((sum, repo) => sum + repo.indexed_files, 0)
			};

		} catch (error) {
			console.error('MCP Service Error:', error);
			return {
				success: false,
				repositories: [],
				total_repositories: 0,
				total_chunks: 0,
				error: error instanceof Error ? error.message : 'Unknown MCP error'
			};
		}
	}

	/**
	 * Parse MCP repository response text into structured data
	 */
	private static parseMCPRepositoryResponse(responseText: string): MCPRepository[] {
		const repositories: MCPRepository[] = [];

		// Parse the response text to extract repository information
		const lines = responseText.split('\n');

		for (const line of lines) {
			// Look for lines that start with "  • " (repository entries)
			if (line.startsWith('  • ')) {
				const match = line.match(/• ([^:]+): (\d+(?:,\d+)*) chunks, last indexed (.+)/);
				if (match) {
					const [, name, chunksStr, lastIndexedStr] = match;
					const chunks = parseInt(chunksStr.replace(/,/g, ''), 10);
					const lastIndexed = new Date(lastIndexedStr).getTime();

					repositories.push({
						name: name.trim(),
						needs_indexing: false,
						indexing_status: 'completed',
						indexed_files: chunks,
						total_files: chunks,
						last_indexed: lastIndexed,
						progress: 100,
						chunks
					});
				}
			}
		}

		return repositories;
	}

	/**
	 * Start indexing for a repository using actual MCP tools
	 */
	static async startRepositoryIndexing(repositoryName: string, repositoryPath?: string): Promise<{
		success: boolean;
		message: string;
		status: string;
		error?: string;
	}> {
		try {
			// Use the actual MCP tool to start indexing
			const mcpResult = await fetch('/api/mcp/start-indexing', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					repo_name: repositoryName,
					repo_path: repositoryPath || `/workspace/${repositoryName}`
				})
			});

			if (!mcpResult.ok) {
				throw new Error(`MCP indexing API call failed: ${mcpResult.status}`);
			}

			const result = await mcpResult.json();

			return {
				success: true,
				message: `Repository ${repositoryName} indexing started`,
				status: 'indexing'
			};

		} catch (error) {
			console.error('MCP Indexing Error:', error);
			return {
				success: false,
				message: `Failed to start indexing for ${repositoryName}`,
				status: 'error',
				error: error instanceof Error ? error.message : 'Unknown indexing error'
			};
		}
	}

	/**
	 * Get repository information by name using actual MCP tools
	 */
	static async getRepositoryInfo(repositoryName: string): Promise<{
		success: boolean;
		repository?: MCPRepository;
		error?: string;
	}> {
		try {
			// Use the actual MCP tool to get repository info
			const mcpResult = await fetch('/api/mcp/repo-info', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repo_name: repositoryName })
			});

			if (!mcpResult.ok) {
				throw new Error(`MCP repo info API call failed: ${mcpResult.status}`);
			}

			const result = await mcpResult.json();

			// If specific repo info isn't available, fall back to repository list
			if (!result.success) {
				const repositoriesResponse = await this.getRepositories();
				if (!repositoriesResponse.success) {
					throw new Error(repositoriesResponse.error || 'Failed to fetch repositories');
				}

				const repository = repositoriesResponse.repositories.find(repo => repo.name === repositoryName);

				if (!repository) {
					return {
						success: false,
						error: `Repository ${repositoryName} not found`
					};
				}

				return {
					success: true,
					repository
				};
			}

			return {
				success: true,
				repository: result.repository
			};

		} catch (error) {
			console.error('MCP Repository Info Error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown repository info error'
			};
		}
	}
} 