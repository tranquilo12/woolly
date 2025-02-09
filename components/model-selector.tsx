import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { cn } from "@/lib/utils"

interface ModelSelectorProps {
	onModelChange: (model: string) => void;
	currentModel?: string;
	className?: string;
}

const AVAILABLE_MODELS = [
	{ value: "gpt-4o", label: "GPT-4o" },
	{ value: "gpt-4o-mini", label: "GPT-4o Mini" },
]

export function ModelSelector({ onModelChange, currentModel = "gpt-4o", className }: ModelSelectorProps) {
	return (
		<Select
			value={currentModel}
			onValueChange={onModelChange}
		>
			<SelectTrigger className={cn(
				"h-7 w-[120px] text-xs",
				"bg-background/50 hover:bg-accent/50",
				"border border-border/50 hover:border-border",
				"transition-all duration-200",
				className
			)}>
				<SelectValue placeholder="Select Model" />
			</SelectTrigger>
			<SelectContent>
				{AVAILABLE_MODELS.map((model) => (
					<SelectItem
						key={model.value}
						value={model.value}
						className="text-xs"
					>
						{model.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
} 