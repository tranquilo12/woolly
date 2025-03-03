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
	});

	return (
		<path
			id={id}
			className={`react-flow__edge-path ${animated ? 'animate-pulse' : ''}`}
			d={edgePath}
			style={style}
			markerEnd={markerEnd}
		/>
	);
}); 