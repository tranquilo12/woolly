import { AVAILABLE_REPOSITORIES, AvailableRepository } from './constants';

export interface RepositoryCommand {
	type: 'repository';
	repository: AvailableRepository;
	query: string;
}

export function parseRepositoryCommand(input: string): RepositoryCommand | null {
	// Match @RepoName pattern
	const commandMatch = input.match(/@([\w-]+)(.*)/);
	if (!commandMatch) return null;

	const [, repoName, remainingText] = commandMatch;

	// Check if it's a valid repository
	if (!AVAILABLE_REPOSITORIES.includes(repoName as AvailableRepository)) {
		return null;
	}

	return {
		type: 'repository',
		repository: repoName as AvailableRepository,
		query: remainingText.trim()
	};
}

export function isRepositoryCommand(input: string): boolean {
	return parseRepositoryCommand(input) !== null;
} 