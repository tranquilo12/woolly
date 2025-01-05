export const AVAILABLE_REPOSITORIES = ['PolygonData', 'ParationalAddOn', "vercel-chat-template"] as const;
export const INDEXER_BASE_URL = 'http://localhost:7779';

export type AvailableRepository = typeof AVAILABLE_REPOSITORIES[number]; 