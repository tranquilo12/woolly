export const AVAILABLE_REPOSITORIES = ['PolygonData', 'ParationalAddOn', "vercel-chat-template"] as const;
// Note: Direct indexer access deprecated - using MCP integration
export const INDEXER_BASE_URL = 'http://localhost:8009';  // Updated to MCP server port

export type AvailableRepository = typeof AVAILABLE_REPOSITORIES[number]; 