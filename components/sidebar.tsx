"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { PlusIcon, TrashIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Chat {
	id: string;
	title: string;
	created_at: string;
	updated_at: string | null;
}

export function Sidebar() {
	const router = useRouter();
	const [chats, setChats] = useState<Chat[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState("");

	// Fetch chats on mount
	useEffect(() => {
		fetchChats();
	}, []);

	const fetchChats = async () => {
		try {
			const response = await fetch("/api/chats");
			if (!response.ok) throw new Error("Failed to fetch chats");
			const data = await response.json();
			setChats(data);
		} catch (error) {
			toast.error("Failed to load chats");
		}
	};

	const createNewChat = async () => {
		try {
			const response = await fetch("/api/chat/create", {
				method: "POST",
			});

			if (!response.ok) throw new Error("Failed to create chat");

			const data = await response.json();
			router.push(`/chat/${data.id}`);
			fetchChats(); // Refresh the list
		} catch (error) {
			toast.error("Failed to create new chat");
		}
	};

	const deleteChat = async (chatId: string) => {
		try {
			const response = await fetch(`/api/chat/${chatId}`, {
				method: "DELETE",
			});

			if (!response.ok) throw new Error("Failed to delete chat");

			toast.success("Chat deleted");
			fetchChats(); // Refresh the list
		} catch (error) {
			toast.error("Failed to delete chat");
		}
	};

	const updateChatTitle = async (chatId: string, newTitle: string) => {
		try {
			const response = await fetch(`/api/chat/${chatId}/title`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ title: newTitle }),
			});

			if (!response.ok) throw new Error("Failed to update chat title");

			fetchChats(); // Refresh the list
			setEditingId(null);
		} catch (error) {
			toast.error("Failed to update chat title");
		}
	};

	return (
		<div className="flex flex-col h-full">
			{/* New Chat Button */}
			<div className="p-4">
				<Button
					onClick={createNewChat}
					className="w-full justify-start"
					variant="outline"
				>
					<PlusIcon className="mr-2 h-4 w-4" />
					New Chat
				</Button>
			</div>

			{/* Chat List */}
			<div className="flex-1 overflow-auto p-2">
				{chats.map((chat) => (
					<div
						key={chat.id}
						className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg group"
					>
						{editingId === chat.id ? (
							<input
								placeholder="New Chat"
								type="text"
								value={editingTitle}
								onChange={(e) => setEditingTitle(e.target.value)}
								onBlur={() => updateChatTitle(chat.id, editingTitle)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										updateChatTitle(chat.id, editingTitle);
									} else if (e.key === 'Escape') {
										setEditingId(null);
									}
								}}
								className="flex-1 px-2 py-1 text-sm bg-transparent border rounded"
								autoFocus
							/>
						) : (
							<Link
								href={`/chat/${chat.id}`}
								className="flex-1 truncate text-sm"
								onClick={() => {
									setEditingTitle(chat.title);
								}}
							>
								{chat.title}
							</Link>
						)}
						<div className="flex gap-1 opacity-0 group-hover:opacity-100">
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={(e) => {
									e.preventDefault();
									setEditingId(chat.id);
									setEditingTitle(chat.title);
								}}
							>
								<PencilIcon className="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={(e) => {
									e.preventDefault();
									deleteChat(chat.id);
								}}
							>
								<TrashIcon className="h-4 w-4" />
							</Button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
} 