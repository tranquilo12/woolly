import { TableCell, TableRow } from "./ui/table";
import { motion } from "framer-motion";

interface IndexingProgressRowProps {
	processedCount?: number;
	totalFiles?: number;
	progress?: number;
}

export function IndexingProgressRow({ processedCount, totalFiles, progress }: IndexingProgressRowProps) {
	if (processedCount === undefined || totalFiles === undefined) return null;

	return (
		<TableRow className="h-[68px] min-h-[68px]">
			<TableCell className="font-medium whitespace-nowrap">Progress</TableCell>
			<TableCell>
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.2 }}
					className="flex flex-col justify-center h-full gap-2"
				>
					<div className="flex items-center h-5 truncate">
						{processedCount} / {totalFiles} files
					</div>
					{progress !== undefined && (
						<motion.div
							className="h-2 bg-muted/20 rounded w-full"
							layout
						>
							<motion.div
								className="h-full bg-blue-500"
								style={{ width: `${progress}%` }}
								transition={{ duration: 0.5 }}
							/>
						</motion.div>
					)}
				</motion.div>
			</TableCell>
		</TableRow>
	);
} 