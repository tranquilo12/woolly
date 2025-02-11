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