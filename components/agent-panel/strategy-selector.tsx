import { Strategy } from "@/lib/api/documentation";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Code, FileText, Settings, Database } from "lucide-react";

interface StrategySelectorProps {
	value: string;
	onChange: (value: string) => void;
	strategies: Strategy[];
}

// Helper function to get the appropriate icon for a strategy
const getStrategyIcon = (strategyName: string) => {
	const iconProps = { className: "h-5 w-5" };

	if (strategyName.toLowerCase().includes('api')) {
		return <Database {...iconProps} />;
	} else if (strategyName.toLowerCase().includes('code')) {
		return <Code {...iconProps} />;
	} else if (strategyName.toLowerCase().includes('maintenance')) {
		return <Settings {...iconProps} />;
	} else {
		return <FileText {...iconProps} />;
	}
};

export function StrategySelector({ value, onChange, strategies }: StrategySelectorProps) {
	return (
		<div className="grid grid-cols-1 gap-3 mt-2">
			{strategies.map(strategy => (
				<Card
					key={strategy.name}
					className={cn(
						"flex items-start p-3 gap-3 border border-border/50 hover:border-border cursor-pointer",
						"transition-colors duration-200",
						value === strategy.name && "border-primary bg-primary/5"
					)}
					onClick={() => onChange(strategy.name)}
				>
					<div className={cn(
						"rounded-md p-2 bg-muted",
						value === strategy.name && "bg-primary/10 text-primary"
					)}>
						{getStrategyIcon(strategy.name)}
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-medium">{strategy.name}</span>
						<span className="text-xs text-muted-foreground">
							{strategy.description}
						</span>
						<span className="text-xs text-muted-foreground mt-1">
							{strategy.steps} steps • Est. time: {strategy.steps * 2} min
						</span>
					</div>
				</Card>
			))}
		</div>
	);
} 