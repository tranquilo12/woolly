import { memo } from 'react';
import { EdgeProps, getSmoothStepPath } from 'reactflow';

export const DocumentationEdge = memo(function DocumentationEdge({
	id,
	source,
	target,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	style = {},
	markerEnd,
	animated,
}: EdgeProps) {
	const [edgePath] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		borderRadius: 16,
	});

	return (
		<>
			{/* Shadow path for depth effect */}
			<path
				id={`${id}-shadow`}
				className="react-flow__edge-path"
				d={edgePath}
				style={{
					...style,
					stroke: 'rgba(0, 0, 0, 0.1)',
					strokeWidth: (style.strokeWidth as number || 2) + 2,
					filter: 'blur(2px)',
				}}
			/>
			{/* Main edge path */}
			<path
				id={id}
				className={`react-flow__edge-path transition-all duration-300 ${animated ? 'animate-pulse' : ''
					}`}
				d={edgePath}
				style={{
					...style,
					strokeDasharray: animated ? '5,5' : 'none',
					animation: animated ? 'flow 1s linear infinite' : 'none',
				}}
				markerEnd={markerEnd}
			/>
		</>
	);
}); 