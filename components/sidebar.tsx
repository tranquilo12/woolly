"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { PlusIcon, TrashIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "./sidebar-provider";
import { useClickOutside } from '@/hooks/use-click-outside';
import { cn } from "@/lib/utils";
import { MessageCircleIcon } from "lucide-react";

interface Chat {
	id: string;
	title: string;
	created_at: string;
}

export function Sidebar() {
	const router = useRouter();
	const [chats, setChats] = useState<{ chats: Chat[] }>({ chats: [] });
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState("");
	const { isOpen, toggle } = useSidebar();
	const sidebarRef = useRef<HTMLDivElement>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const checkAuth = async () => {
			try {
				const response = await fetch("/api/auth/session");
				const session = await response.json();

				if (session?.user) {
					fetchChats();
				}
			} catch (error) {
				console.error("Auth check failed:", error);
				setError("Authentication failed");
			} finally {
				setIsLoading(false);
			}
		};

		checkAuth();
	}, []);

	const fetchChats = async () => {
		try {
			setIsLoading(true);
			const response = await fetch("/api/chats");
			if (!response.ok) throw new Error("Failed to fetch chats");
			const data = await response.json();
			setChats(data);
			setError(null);
		} catch (error) {
			console.error("Failed to load chats:", error);
			setError("Failed to load chats");
		} finally {
			setIsLoading(false);
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

	useClickOutside(sidebarRef, () => {
		if (isOpen) {
			toggle();
		}
	});

	// Render empty state
	const EmptyState = () => (
		<div className="flex flex-col items-center justify-center h-full p-4 text-center text-muted-foreground">
			<div className="mb-4">
				<MessageCircleIcon size={24} />
			</div>
			<h3 className="mb-2 text-sm font-medium">No conversations yet</h3>
			<p className="text-sm mb-4">Start a new chat to begin conversing.</p>
			<button
				onClick={createNewChat}
				className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
			>
				Start New Chat
			</button>
		</div>
	);

	// Render loading state
	if (isLoading) {
		return (
			<div className="fixed top-14 right-0 bottom-0 w-80 border-l bg-muted/40 backdrop-blur-sm">
				<div className="flex items-center justify-center h-full">
					<div className="animate-pulse text-muted-foreground">Loading...</div>
				</div>
			</div>
		);
	}

	// Render error state
	if (error) {
		return (
			<div className="fixed top-14 right-0 bottom-0 w-80 border-l bg-muted/40 backdrop-blur-sm">
				<div className="flex flex-col items-center justify-center h-full p-4">
					<p className="text-destructive mb-2">{error}</p>
					<button
						onClick={fetchChats}
						className="text-sm px-3 py-1 rounded-md bg-muted hover:bg-muted/80"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div
			ref={sidebarRef}
			className={cn(
				"fixed top-14 right-0 bottom-0 w-80 border-l bg-muted/40 backdrop-blur-sm",
				isOpen ? "translate-x-0" : "translate-x-full"
			)}
		>
			{Array.isArray(chats.chats) && chats.chats.length === 0 ? (
				<EmptyState />
			) : (
				<div className="flex flex-col h-full">
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

					<div className="flex-1 overflow-auto p-2">
						{chats.chats.map((chat) => (
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
			)}
		</div>
	);
} 