import axios from 'axios';

// Create base API instance
export const api = axios.create({
	baseURL: '/api',  // This will be relative to your frontend URL
	headers: {
		'Content-Type': 'application/json',
	},
});

// Add any global interceptors or configuration here
api.interceptors.response.use(
	response => response,
	error => {
		// Global error handling
		return Promise.reject(error);
	}
);

// Add a utility function to normalize agent data
export function normalizeAgentData(agentData: any) {
	if (!agentData) return null;

	return {
		...agentData,
		// Ensure id is a string
		id: typeof agentData.id === 'object' ? String(agentData.id) : agentData.id,
		// Ensure tools is a proper list
		tools: typeof agentData.tools === 'string'
			? (agentData.tools === '[]' ? [] : JSON.parse(agentData.tools))
			: (Array.isArray(agentData.tools) ? agentData.tools : [])
	};
} 