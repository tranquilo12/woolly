import type { AxiosError } from 'axios';
import { api } from './index';

export interface Strategy {
	name: string;
	description: string;
	steps: number;
}

export interface StrategyStep {
	[x: string]: any;
	id: number;
	title: string;
	prompt: string;
}

export interface StrategyDetails {
	name: string;
	description: string;
	steps: StrategyStep[];
}

export const documentationApi = {
	async listStrategies(): Promise<Strategy[]> {
		try {
			const response = await api.get<Strategy[]>('/strategies');
			return response.data;
		} catch (error: unknown) {
			if (isAxiosError(error) && error.response?.status === 503) {
				throw new Error('Documentation service not initialized');
			}
			throw new Error('Failed to fetch documentation strategies');
		}
	},

	async getStrategyDetails(strategyName: string): Promise<StrategyDetails> {
		try {
			const response = await api.get<StrategyDetails>(`/strategies/${strategyName}`);
			return response.data;
		} catch (error: unknown) {
			if (isAxiosError(error) && error.response?.status === 404) {
				throw new Error(`Strategy '${strategyName}' not found`);
			}
			throw new Error('Failed to fetch strategy details');
		}
	}
};

// Type guard for AxiosError
function isAxiosError(error: unknown): error is AxiosError {
	return (error as AxiosError)?.isAxiosError === true;
} 