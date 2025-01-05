"use client";

import { RepositoryList } from "./repository-list";
import { motion } from "framer-motion";

export function RepositorySection() {
	return (
		<motion.div
			layout
			className="w-full flex-1 overflow-auto sidebar-scroll rounded-xl bg-background/50"
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