"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { PlusIcon, TrashIcon, PencilIcon, MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "./sidebar-provider";
import { useClickOutside } from '@/hooks/use-click-outside';
import { cn } from "@/lib/utils";
import { Message } from 'ai';
import { Session } from "next-auth";
import { useSession } from "next-auth/react";

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
	const fetchingRef = useRef(false);
	const { data: session } = useSession();

	const fetchChats = async () => {
		if (fetchingRef.current) return;

		try {
			fetchingRef.current = true;
			setIsLoading(true);
			const response = await fetch("/api/chats", {
				headers: {
					'Cache-Control': 'no-store',
					'Pragma': 'no-cache'
				}
			});
			if (!response.ok) throw new Error("Failed to fetch chats");
			const data = await response.json();
			setChats({ chats: Array.isArray(data.chats) ? data.chats : [] });
		} catch (error) {
			console.error("Failed to load chats:", error);
			setError("Failed to load chats");
			setChats({ chats: [] });
		} finally {
			setIsLoading(false);
			fetchingRef.current = false;
		}
	};

	useEffect(() => {
		fetchChats();
		return () => {
			fetchingRef.current = true;
		};
	}, []);

	const createNewChat = async (session: Session) => {
		try {
			const response = await fetch("/api/chat/create", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					userId: session.user.id,
					messages: []
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Create chat error:', errorText);
				throw new Error("Failed to create chat");
			}

			const data = await response.json();
			router.push(`/chat/${data.id}`);
			fetchChats();
		} catch (error) {
			console.error('Create chat error:', error);
			toast.error("Failed to create new chat");
		}
	};

	const deleteChat = async (id: string) => {
		try {
			const response = await fetch(`/api/chats/${id}`, { method: "DELETE" });
			if (!response.ok) throw new Error("Failed to delete chat");
			fetchChats();
			router.push("/chat");
		} catch (error) {
			toast.error("Failed to delete chat");
		}
	};

	const updateChatTitle = async (id: string, title: string) => {
		try {
			const response = await fetch(`/api/chats/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title }),
			});
			if (!response.ok) throw new Error("Failed to update chat title");
			setEditingId(null);
			fetchChats();
		} catch (error) {
			toast.error("Failed to update chat title");
		}
	};

	useClickOutside(sidebarRef, () => {
		if (isOpen) toggle();
	});

	return (
		<AnimatePresence mode="wait">
			{isOpen && (
				<motion.div
					ref={sidebarRef}
					initial={{ x: "-100%" }}
					animate={{ x: 0 }}
					exit={{ x: "-100%" }}
					transition={{ type: "spring", stiffness: 300, damping: 30 }}
					className="fixed top-14 left-0 bottom-0 w-80 border-r bg-muted/40 backdrop-blur-sm z-50"
				>
					<div className="flex flex-col h-full">
						<div className="p-4">
							<Button onClick={() => createNewChat(session as Session)} className="w-full justify-start" variant="outline">
								<PlusIcon className="mr-2 h-4 w-4" />
								New Chat
							</Button>
						</div>

						<div className="flex-1 overflow-auto p-2">
							{chats.chats.map((chat) => (
								<div key={chat.id} className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg group">
									{editingId === chat.id ? (
										<input
											title="Chat Title"
											type="text"
											value={editingTitle}
											onChange={(e) => setEditingTitle(e.target.value)}
											onBlur={() => updateChatTitle(chat.id, editingTitle)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') updateChatTitle(chat.id, editingTitle);
												if (e.key === 'Escape') setEditingId(null);
											}}
											className="flex-1 px-2 py-1 text-sm bg-transparent border rounded"
											autoFocus
										/>
									) : (
										<Link href={`/chat/${chat.id}`} className="flex-1 truncate text-sm">
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
				</motion.div>
			)}
		</AnimatePresence>
	);
} 