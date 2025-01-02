import { useState, useRef, useEffect } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { CheckedSquare, CrossIcon } from "./icons";

interface EditMessageInputProps {
	initialContent: string;
	onSave: (content: string) => void;
	onCancel: () => void;
}

export function EditMessageInput({ initialContent, onSave, onCancel }: EditMessageInputProps) {
	const [content, setContent] = useState(initialContent);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
			textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
		}
	}, [content]);

	return (
		<div className="relative w-full">
			<Textarea
				ref={textareaRef}
				value={content}
				onChange={(e) => setContent(e.target.value)}
				className="min-h-[100px] resize-none pr-20"
				autoFocus
			/>
			<div className="absolute right-2 top-2 flex gap-2">
				<Button
					size="sm"
					variant="ghost"
					onClick={() => onSave(content)}
					className="h-8 w-8 p-0"
				>
					<CheckedSquare />
				</Button>
				<Button
					size="sm"
					variant="ghost"
					onClick={onCancel}
					className="h-8 w-8 p-0"
				>
					<CrossIcon />
				</Button>
			</div>
		</div>
	);
} 