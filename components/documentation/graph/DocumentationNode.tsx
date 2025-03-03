import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CheckCircle, ChevronRight } from 'lucide-react';
import { StrategyStep } from '@/lib/api/documentation';

interface DocumentationNodeData {
	step: StrategyStep;
	index: number;
	isCompleted: boolean;
	isCurrent: boolean;
	onClick: () => void;
}

export const DocumentationNode = memo(function DocumentationNode({
	data,
}: NodeProps<DocumentationNodeData>) {
	const { step, index, isCompleted, isCurrent, onClick } = data;

	return (
		<div
			className={`
				group p-4 rounded-lg shadow-lg w-[280px] cursor-pointer transition-all duration-300
				${isCurrent ? 'bg-primary text-primary-foreground scale-105 ring-2 ring-primary' : 'bg-card text-card-foreground hover:scale-105'}
				${isCompleted ? 'border-2 border-green-500/50' : 'border border-muted'}
				hover:shadow-xl hover:ring-2 hover:ring-primary/50
			`}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onClick();
				}
			}}
		>
			{/* Source handle (top) */}
			{index > 0 && (
				<Handle
					type="target"
					position={Position.Top}
					className={`w-3 h-3 transition-colors duration-200
						${isCompleted ? 'bg-green-500' : 'bg-muted-foreground'}
						${isCurrent ? 'bg-primary-foreground' : ''}
					`}
				/>
			)}

			{/* Node content */}
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<span className={`
						text-sm font-medium px-2 py-0.5 rounded-full
						${isCurrent ? 'bg-primary-foreground/20' : 'bg-muted'}
					`}>
						Step {index + 1}
					</span>
					{isCompleted && (
						<CheckCircle className="w-4 h-4 text-green-500" />
					)}
				</div>
			</div>

			<h3 className="text-base font-semibold mb-2 truncate flex items-center gap-2">
				{step.title}
				<ChevronRight className={`
					w-4 h-4 transition-transform duration-300
					${isCurrent ? 'translate-x-1' : 'group-hover:translate-x-1'}
				`} />
			</h3>

			<p className={`
				text-sm line-clamp-2 transition-colors duration-200
				${isCurrent ? 'text-primary-foreground/80' : 'text-muted-foreground'}
			`}>
				{step.description || 'No description available'}
			</p>

			{/* Target handle (bottom) */}
			{index < 4 && (
				<Handle
					type="source"
					position={Position.Bottom}
					className={`w-3 h-3 transition-colors duration-200
						${isCompleted ? 'bg-green-500' : 'bg-muted-foreground'}
						${isCurrent ? 'bg-primary-foreground' : ''}
					`}
				/>
			)}
		</div>
	);
}); 