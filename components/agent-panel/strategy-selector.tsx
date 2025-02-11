import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Strategy } from "@/lib/api/documentation";

interface StrategySelectorProps {
	value: string;
	onChange: (value: string) => void;
	strategies: Strategy[];
}

export function StrategySelector({ value, onChange, strategies }: StrategySelectorProps) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger className="w-[250px] h-10">
				<SelectValue placeholder="Select strategy" />
			</SelectTrigger>
			<SelectContent>
				{strategies.map(strategy => (
					<SelectItem key={strategy.name} value={strategy.name}>
						<div className="flex flex-col py-1">
							<span className="text-sm font-medium">{strategy.name}</span>
							<span className="text-xs text-muted-foreground">
								{strategy.description}
							</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
} 