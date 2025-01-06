import { Repository } from "@/hooks/use-repository-status";
import { TableCell, TableRow } from "./ui/table";
import { RepositoryStats } from "@/hooks/use-repository-status";

interface StaticRepositoryStatsProps {
	stats: RepositoryStats | null;
	repository: Repository | undefined;
}

export function StaticRepositoryStats({ stats, repository }: StaticRepositoryStatsProps) {
	return (
		<>
			{stats && (
				<>
					<TableRow>
						<TableCell className="font-medium">Total Points</TableCell>
						<TableCell className="truncate">{stats.total_points.toLocaleString()}</TableCell>
					</TableRow>
					<TableRow>
						<TableCell className="font-medium">Collection</TableCell>
						<TableCell className="truncate">{stats.collection}</TableCell>
					</TableRow>
				</>
			)}
			{repository?.language && (
				<TableRow>
					<TableCell className="font-medium">Language</TableCell>
					<TableCell className="truncate">{repository.language}</TableCell>
				</TableRow>
			)}
			{repository?.last_indexed && (
				<TableRow>
					<TableCell className="font-medium">Last Indexed</TableCell>
					<TableCell className="truncate">
						{new Date(repository.last_indexed).toLocaleString()}
					</TableCell>
				</TableRow>
			)}
		</>
	);
}