"use client";

import { RepositoryList } from "./repository-list";

export function RepositorySection() {
	return (
		<div className="w-full flex-1 overflow-auto sidebar-scroll rounded-xl bg-background/50">
			<div className="p-2 space-y-2">
				<RepositoryList />
			</div>
		</div>
	);
} 