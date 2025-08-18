'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Play, Check, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

interface PipelineFlowProps {
	steps: any[];
	currentStep: number;
	completedSteps: number[];
	onStepClick: (index: number) => void;
	onRestartFlow?: () => void;
	onAddChildNode?: (parentId: string) => void;
	results?: Record<string, any>;
	className?: string;
	version?: number;
	history?: Array<{
		version: number;
		stepResults: Record<string, any>;
		completedSteps: number[];
	}>;
	onRestoreVersion?: (versionIndex: number) => void;
	isLoading?: boolean;
	loadingStep?: number;
	scrollToMessage?: (stepIndex: number) => void;
}

export function PipelineFlow({
	steps,
	currentStep,
	completedSteps,
	onStepClick,
	onRestartFlow,
	onAddChildNode,
	results = {},
	className,
	version = 1,
	history = [],
	onRestoreVersion,
	isLoading = false,
	loadingStep,
	scrollToMessage
}: PipelineFlowProps) {
	// Debug log for props
	console.log('PipelineFlow: Received props:', {
		currentStep,
		completedSteps,
		isLoading,
		loadingStep,
		stepsLength: steps.length
	});

	// Add a dropdown for version history
	const [showVersionHistory, setShowVersionHistory] = useState(false);
	// Add state for button click feedback
	const [clickedStepIndex, setClickedStepIndex] = useState<number | null>(null);
	const [clickedRunAll, setClickedRunAll] = useState(false);

	// Add a function to handle step button clicks with visual feedback
	const handleStepButtonClick = (index: number) => {
		console.log('PipelineFlow: handleStepButtonClick called with index:', index);
		console.log('PipelineFlow: Current state:', {
			currentStep,
			completedSteps,
			isLoading,
			loadingStep
		});

		// Set the clicked step index for visual feedback
		setClickedStepIndex(index);

		// Call the onStepClick function
		onStepClick(index);

		// Scroll to the corresponding message if the function is provided
		if (scrollToMessage) {
			scrollToMessage(index);
		}

		// Reset the clicked step index after a short delay
		setTimeout(() => {
			setClickedStepIndex(null);
		}, 300);
	};

	// Add a function to handle run all button clicks with visual feedback
	const handleRunAllClick = () => {
		// Set the clicked run all state for visual feedback
		setClickedRunAll(true);

		// Call the onRestartFlow function
		if (onRestartFlow) {
			onRestartFlow();
		}

		// Reset the clicked run all state after a short delay
		setTimeout(() => {
			setClickedRunAll(false);
		}, 300);
	};

	return (
		<div className={cn("w-full bg-background/80 p-3 rounded-md border border-border/30 mb-4", className)}>
			<div className="flex justify-between items-center mb-3">
				<div className="flex items-center gap-4">
					<span className="text-sm font-medium">Pipeline Flow</span>
					<Button
						variant="secondary"
						size="sm"
						className={cn(
							"h-6 text-xs flex items-center gap-1 transition-all duration-300",
							isLoading && "bg-primary/10 text-primary border-primary/30",
							clickedRunAll && "scale-95 opacity-80" // Add visual feedback for button click
						)}
						onClick={handleRunAllClick}
						title="Run all steps in sequence"
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<span className="animate-pulse">Running...</span>
							</>
						) : (
							<>
								<Play className="h-3 w-3" />
								<span>Run All</span>
							</>
						)}
					</Button>
					{version > 1 && (
						<div className="relative">
							<Button
								variant="ghost"
								size="sm"
								className="h-6 text-xs flex items-center gap-1"
								onClick={() => setShowVersionHistory(!showVersionHistory)}
								disabled={isLoading}
							>
								v{version}
								{showVersionHistory ? (
									<ChevronUp className="h-3 w-3" />
								) : (
									<ChevronDown className="h-3 w-3" />
								)}
							</Button>

							{showVersionHistory && history.length > 0 && (
								<div className="absolute top-full left-0 z-10 mt-1 w-48 bg-background border border-border rounded-md shadow-md">
									<div className="p-1 text-xs font-medium border-b border-border/50">Version History</div>
									<div className="max-h-32 overflow-y-auto">
										{history.map((item, index) => (
											<button
												key={index}
												className="w-full text-left px-2 py-1 text-xs hover:bg-muted/50 flex items-center justify-between"
												onClick={() => {
													onRestoreVersion?.(index);
													setShowVersionHistory(false);
												}}
											>
												<span>Version {item.version}</span>
												<span className="text-muted-foreground">{item.completedSteps.length} steps</span>
											</button>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</div>

			<div className="flex gap-4 overflow-x-auto pb-2">
				{steps.map((step, index) => {
					const isStepLoading = isLoading && (loadingStep === index || (loadingStep === undefined && currentStep === index));

					return (
						<div
							key={index}
							className={cn(
								"flex flex-col min-w-[150px] px-4 py-2 rounded-md border transition-all duration-300",
								isStepLoading ? "border-primary/50 bg-primary/5 shadow-sm" :
									completedSteps.includes(index) ? "border-primary/30 bg-background" :
										"border-border/50 bg-background"
							)}
						>
							<div className="flex items-center justify-between mb-1">
								<span className="text-sm font-medium flex-1">{step.title}</span>
								<Button
									variant="ghost"
									size="icon"
									className={cn(
										"h-6 w-6 ml-1",
										clickedStepIndex === index && "scale-95 opacity-80" // Add visual feedback for button click
									)}
									onClick={() => handleStepButtonClick(index)}
									title="Run only this step"
									aria-label={`Run only the ${step.title} step`}
									disabled={isLoading}
								>
									<Play className="h-3 w-3" />
								</Button>
							</div>

							{isStepLoading && (
								<div className="text-xs text-primary mt-1 mb-2 bg-primary/10 p-1 rounded animate-pulse">
									Processing...
								</div>
							)}

							{results && results[`step-${index}`] && !isStepLoading && (
								<div className="text-xs text-muted-foreground mt-1 mb-2 bg-background/50 p-1 rounded">
									{typeof results[`step-${index}`] === 'object' ?
										Object.keys(results[`step-${index}`]).length + ' results' :
										'Results available'}
								</div>
							)}

							{onAddChildNode && (
								<div className="flex justify-center mt-2">
									<Button
										variant="ghost"
										size="sm"
										className="h-6 text-xs flex items-center gap-1"
										onClick={() => onAddChildNode(`step-${index}`)}
										disabled={isLoading}
									>
										<PlusCircle className="h-3 w-3" />
										<span>Add step</span>
									</Button>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
