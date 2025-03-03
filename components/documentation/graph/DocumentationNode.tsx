import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CheckCircle } from 'lucide-react';
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
				p-4 rounded-lg shadow-md w-[250px] cursor-pointer transition-all duration-200
				${isCurrent ? 'bg-primary text-primary-foreground ring-2 ring-primary' : 'bg-card text-card-foreground'}
				${isCompleted ? 'border-green-500' : 'border-muted'}
				hover:ring-2 hover:ring-primary/50
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
					className="w-3 h-3 bg-muted-foreground"
				/>
			)}

			{/* Node content */}
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">Step {index + 1}</span>
					{isCompleted && (
						<CheckCircle className="w-4 h-4 text-green-500" />
					)}
				</div>
			</div>

			<h3 className="text-base font-semibold mb-1 truncate">{step.title}</h3>
			<p className="text-xs text-muted-foreground line-clamp-2">
				{step.description || 'No description available'}
			</p>

			{/* Target handle (bottom) */}
			{index < 4 && (
				<Handle
					type="source"
					position={Position.Bottom}
					className="w-3 h-3 bg-muted-foreground"
				/>
			)}
		</div>
	);
}); 