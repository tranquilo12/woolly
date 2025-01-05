"use client";

import { RepositoryList } from "./repository-list";
import { motion } from "framer-motion";

export function RepositorySection() {
	return (
		<motion.div
			layout
			className="w-full flex-1 overflow-auto sidebar-scroll rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm shadow-[0_0_15px_rgba(20,20,20,0.1)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] dark:bg-muted/20"
			initial="hidden"
			animate="visible"
			transition={{
				layout: {
					duration: 0.2,
					ease: [0.4, 0, 0.2, 1]
				}
			}}
		>
			<div className="p-2 space-y-2">
				<RepositoryList />
			</div>
		</motion.div>
	);
} 