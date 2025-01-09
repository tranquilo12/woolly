import { AVAILABLE_REPOSITORIES, AvailableRepository } from './constants';

export interface RepositoryCommand {
	type: 'repository';
	repository: AvailableRepository;
	query: string;
}

export function parseRepositoryCommand(input: string): RepositoryCommand | null {
	console.log('🔍 Parsing repository command:', { input });

	if (!input) {
		console.log('❌ Empty input detected');
		return null;
	}

	// Match @RepoName pattern anywhere in the input
	const commandMatch = input.match(/@([\w-]+)/);
	if (!commandMatch) {
		console.log('❌ No repository mention found');
		return null;
	}

	const [, repoName] = commandMatch;
	console.log('📦 Extracted repository:', { repoName });

	// Validate if the extracted repository name is in the available repositories
	if (!AVAILABLE_REPOSITORIES.includes(repoName as AvailableRepository)) {
		console.log('❌ Invalid repository name');
		return null;
	}

	// Remove the @repo mention and clean up the query
	const query = input
		.replace(`@${repoName}`, 'this codebase') // Replace @repo mention with "this codebase"
		.replace(/\s+/g, ' ') // Normalize spaces
		.trim();

	if (!query) {
		console.log('❌ No query text found');
		return null;
	}

	console.log('✅ Valid repository command:', { type: 'repository', repository: repoName, query });
	return {
		type: 'repository',
		repository: repoName as AvailableRepository,
		query
	};
}

export function isRepositoryCommand(input: string): boolean {
	return parseRepositoryCommand(input) !== null;
}