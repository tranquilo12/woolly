"use client";

import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { ChevronDown, ChevronRight, File, Folder } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

interface FileTreeNode {
	name: string;
	type: "file" | "directory";
	children?: FileTreeNode[];
	path: string;
}

export function FileTree() {
	const { repositories } = useRepositoryStatus();
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

	// Get the currently active repository (you might want to add this to your state management)
	const activeRepository = repositories.find(repo => repo.stats?.indexing_status === "completed");

	const toggleFolder = (path: string) => {
		setExpandedFolders(prev => {
			const next = new Set(prev);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	};

	const renderNode = (node: FileTreeNode, level: number = 0) => {
		const isExpanded = expandedFolders.has(node.path);
		const paddingLeft = `${level * 1.5}rem`;

		if (node.type === "file") {
			return (
				<div
					key={node.path}
					className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded-sm"
					style={{ paddingLeft }}
				>
					<File size={16} />
					<span className="text-sm">{node.name}</span>
				</div>
			);
		}

		return (
			<div key={node.path}>
				<Button
					variant="ghost"
					size="sm"
					className="w-full justify-start gap-2"
					onClick={() => toggleFolder(node.path)}
					style={{ paddingLeft }}
				>
					{isExpanded ? (
						<ChevronDown size={16} />
					) : (
						<ChevronRight size={16} />
					)}
					<Folder size={16} />
					<span className="text-sm">{node.name}</span>
				</Button>
				{isExpanded && node.children?.map(child => renderNode(child, level + 1))}
			</div>
		);
	};

	if (!activeRepository) {
		return (
			<div className="text-sm text-muted-foreground italic p-4">
				No repository selected or indexed
			</div>
		);
	}

	// For now, return a placeholder message
	// TODO: Implement actual file tree fetching from the backend
	return (
		<div className="py-2">
			<div className="text-sm text-muted-foreground mb-4 px-2">
				Files in {activeRepository.name}
			</div>
			<div className="space-y-1">
				{/* Placeholder tree structure */}
				{renderNode({
					name: activeRepository.name,
					type: "directory",
					path: "/",
					children: [
						{
							name: "src",
							type: "directory",
							path: "/src",
							children: [
								{ name: "main.py", type: "file", path: "/src/main.py" },
								{ name: "utils.py", type: "file", path: "/src/utils.py" },
							]
						},
						{
							name: "docs",
							type: "directory",
							path: "/docs",
							children: [
								{ name: "README.md", type: "file", path: "/docs/README.md" }
							]
						}
					]
				})}
			</div>
		</div>
	);
} 