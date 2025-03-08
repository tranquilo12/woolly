'use client';

import { useState } from 'react';
import { RefreshCw, ChevronUp, ChevronDown, Play, Check, PlusCircle } from 'lucide-react';
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
	onRestoreVersion
}: PipelineFlowProps) {
	// Add a dropdown for version history
	const [showVersionHistory, setShowVersionHistory] = useState(false);

	return (
		<div className={cn("w-full bg-background/80 p-3 rounded-md border border-border/30 mb-4", className)}>
			<div className="flex justify-between items-center mb-3">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium">Pipeline Flow</span>
					{version > 1 && (
						<div className="relative">
							<Button
								variant="ghost"
								size="sm"
								className="h-6 text-xs flex items-center gap-1"
								onClick={() => setShowVersionHistory(!showVersionHistory)}
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

				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground px-2 py-1 bg-muted/30 rounded-full">
						{completedSteps.length} of {steps.length} steps completed
					</span>
					{onRestartFlow && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={onRestartFlow}
							title="Restart flow"
						>
							<RefreshCw className="h-3.5 w-3.5" />
						</Button>
					)}
				</div>
			</div>

			<div className="flex gap-4 overflow-x-auto pb-2">
				{steps.map((step, index) => (
					<div
						key={index}
						className={cn(
							"flex flex-col min-w-[150px] px-4 py-2 rounded-md border transition-all duration-300",
							completedSteps.includes(index) ? "border-primary bg-primary/10" :
								currentStep === index ? "border-primary/70 bg-primary/5" :
									"border-border/50 bg-background"
						)}
					>
						<div className="flex items-center justify-between mb-1">
							<div className={cn(
								"flex items-center justify-center w-5 h-5 rounded-full text-xs mr-2",
								completedSteps.includes(index) ? "bg-primary text-primary-foreground" :
									currentStep === index ? "bg-primary/20 text-primary" :
										"bg-muted text-muted-foreground"
							)}>
								{completedSteps.includes(index) ? <Check className="h-3 w-3" /> : null}
							</div>
							<span className="text-sm font-medium flex-1">{step.title}</span>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 ml-1"
								onClick={() => onStepClick(index)}
								title="Run from this step"
							>
								<Play className="h-3 w-3" />
							</Button>
						</div>

						{results && results[`step-${index}`] && (
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
								>
									<PlusCircle className="h-3 w-3" />
									<span>Add step</span>
								</Button>
							</div>
						)}

						{/* Draw connection line to next step */}
						{index < steps.length - 1 && (
							<div className="absolute right-0 top-1/2 w-4 h-0.5 bg-border transform translate-x-full" />
						)}
					</div>
				))}
			</div>
		</div>
	);
}
