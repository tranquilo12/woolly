import { useCallback, useMemo } from 'react';
import ReactFlow, {
	Background,
	Controls,
	Edge,
	Node,
	NodeTypes,
	EdgeTypes,
	useNodesState,
	useEdgesState,
	Panel,
	ConnectionLineType,
	MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { DocumentationNode } from './DocumentationNode';
import { DocumentationEdge } from './DocumentationEdge';
import { StrategyStep } from '@/lib/api/documentation';

interface DocumentationGraphProps {
	steps: StrategyStep[];
	currentStep: number;
	completedSteps: number[];
	onStepClick: (index: number) => void;
}

export function DocumentationGraph({
	steps,
	currentStep,
	completedSteps,
	onStepClick,
}: DocumentationGraphProps) {
	// Define custom node types
	const nodeTypes: NodeTypes = useMemo(() => ({
		documentationNode: DocumentationNode,
	}), []);

	// Define custom edge types
	const edgeTypes: EdgeTypes = useMemo(() => ({
		documentationEdge: DocumentationEdge,
	}), []);

	// Calculate layout positions for nodes
	const calculateNodePositions = useCallback((numNodes: number) => {
		const radius = 300; // Radius of the circular layout
		const centerX = 400; // Center X coordinate
		const centerY = 300; // Center Y coordinate
		const positions: { x: number; y: number }[] = [];

		// For 5 or fewer nodes, create a semi-circular layout
		const angleStep = Math.PI / (numNodes - 1);

		for (let i = 0; i < numNodes; i++) {
			const angle = i * angleStep;
			const x = centerX + radius * Math.cos(angle);
			const y = centerY + radius * Math.sin(angle);
			positions.push({ x, y });
		}

		return positions;
	}, []);

	// Create nodes from steps
	const initialNodes: Node[] = useMemo(() => {
		if (!steps || !steps.length) return [];

		const positions = calculateNodePositions(steps.length);

		return steps.map((step, index) => {
			const isCompleted = completedSteps.includes(index);
			const isCurrent = currentStep === index;

			return {
				id: `step-${index}`,
				type: 'documentationNode',
				position: positions[index],
				data: {
					step,
					index,
					isCompleted,
					isCurrent,
					onClick: () => onStepClick(index),
				},
			};
		});
	}, [steps, currentStep, completedSteps, onStepClick, calculateNodePositions]);

	// Create edges between nodes
	const initialEdges: Edge[] = useMemo(() => {
		if (!steps || steps.length <= 1) return [];

		return steps.slice(0, -1).map((_, index) => ({
			id: `edge-${index}-${index + 1}`,
			source: `step-${index}`,
			target: `step-${index + 1}`,
			type: 'documentationEdge',
			animated: currentStep > index || currentStep === index,
			style: {
				stroke: completedSteps.includes(index) ? '#10b981' : '#64748b',
				strokeWidth: completedSteps.includes(index) ? 3 : 2,
			},
			markerEnd: {
				type: MarkerType.ArrowClosed,
				color: completedSteps.includes(index) ? '#10b981' : '#64748b',
			},
		}));
	}, [steps, currentStep, completedSteps]);

	// Use React Flow hooks to manage nodes and edges
	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

	// Update nodes and edges when props change
	useMemo(() => {
		setNodes(initialNodes);
		setEdges(initialEdges);
	}, [initialNodes, initialEdges, setNodes, setEdges]);

	return (
		<div className="h-[600px] w-full border rounded-lg overflow-hidden">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				fitView
				fitViewOptions={{ padding: 0.3 }}
				minZoom={0.5}
				maxZoom={1.5}
				defaultViewport={{ x: 0, y: 0, zoom: 1 }}
				connectionLineType={ConnectionLineType.SmoothStep}
				proOptions={{ hideAttribution: true }}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={false}
			>
				<Background color="#64748b" gap={16} size={1} />
				<Controls
					showInteractive={false}
					className="bg-background border-border"
				/>
				<Panel position="top-center" className="bg-background/80 p-2 rounded-md shadow-md">
					<h3 className="text-sm font-medium">Documentation Progress</h3>
				</Panel>
			</ReactFlow>
		</div>
	);
} 