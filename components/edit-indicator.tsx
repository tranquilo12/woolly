import { motion } from "framer-motion";
import { PencilEditIcon } from "./icons";

export function EditIndicator() {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="relative py-4"
		>
			<div className="absolute inset-0 flex items-center">
				<span className="w-full border-t border-border" />
			</div>
			<div className="relative flex justify-center">
				<span className="bg-background px-2 text-xs text-muted-foreground flex items-center gap-1">
					<PencilEditIcon size={12} /> Message edited, regenerating responses...
				</span>
			</div>
		</motion.div>
	);
} 