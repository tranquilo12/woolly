import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

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
			<SelectTrigger className="h-5 w-[100px] text-xs bg-transparent border-none hover:bg-accent/50 transition-colors px-1.5 py-0">
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