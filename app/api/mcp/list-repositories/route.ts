import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
	try {
		const { random_string } = await req.json();

		// This would be replaced with actual MCP tool import when available in server context
		// For now, we simulate the MCP tool call structure

		// Import the MCP tools (this would be available in server context)
		// const { mcp_shriram_prod_108_repo_list_indexed } = await import('@/lib/mcp-tools');
		// const result = await mcp_shriram_prod_108_repo_list_indexed({ random_string });

		// Temporary simulation - replace with actual MCP tool call
		const mcpResult = {
			result: `Found 7 indexed repositories:

  • parational-outlook-addin: 0 chunks, last indexed 2025-07-01 21:08:18 UTC
  • ParationalAddOn: 318 chunks, last indexed 2025-07-01 22:59:09 UTC
  • load-testing-frontend: 62 chunks, last indexed 2025-07-09 02:11:16 UTC
  • parationalOutlook: 518 chunks, last indexed 2025-07-09 02:19:58 UTC
  • woolly: 351 chunks, last indexed 2025-07-11 04:42:28 UTC
  • code-indexing-service: 1,174 chunks, last indexed 2025-07-12 07:42:09 UTC
  • unified-mcp-server: 79 chunks, last indexed 2025-07-12 07:44:03 UTC

Total repositories available for search: 7`
		};

		return NextResponse.json({
			success: true,
			result: mcpResult.result
		});

	} catch (error) {
		console.error('MCP list repositories error:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to list repositories from MCP server',
				result: null
			},
			{ status: 500 }
		);
	}
} 