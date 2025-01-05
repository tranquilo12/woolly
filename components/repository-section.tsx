"use client";

import { RepositoryList } from "./repository-list";
import { motion } from "framer-motion";

export function RepositorySection() {
	const contentVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				delay: 0.1,
				duration: 0.2,
				staggerChildren: 0.05
			}
		}
	};

	return (
		<motion.div
			className="w-full flex-1 overflow-auto sidebar-scroll rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm shadow-[0_0_15px_rgba(20,20,20,0.1)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] dark:bg-muted/20"
			variants={contentVariants}
			initial="hidden"
			animate="visible"
		>
			<div className="p-2 space-y-2">
				<RepositoryList />
			</div>
		</motion.div>
	);
} 