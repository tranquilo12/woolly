import { NextRequest, NextResponse } from 'next/server';
import { MCPService } from '@/lib/api/mcp-service';

export async function GET(req: NextRequest) {
	try {
		// Use the MCPService to fetch real repository data
		const repositoryData = await MCPService.getRepositories();

		return NextResponse.json(repositoryData);

	} catch (error) {
		console.error('Error fetching MCP repositories:', error);

		// Fallback to empty response if MCP server is not available
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to fetch repositories from MCP server',
				repositories: [],
				total_repositories: 0,
				total_chunks: 0
			},
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { action, repository_name, repository_path } = await req.json();

		// Handle repository actions (start indexing, etc.)
		if (action === 'start_indexing') {
			const result = await MCPService.startRepositoryIndexing(repository_name, repository_path);

			return NextResponse.json(result);
		}

		return NextResponse.json(
			{ success: false, error: 'Invalid action' },
			{ status: 400 }
		);

	} catch (error) {
		console.error('Error handling repository action:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to process repository action' },
			{ status: 500 }
		);
	}
} 