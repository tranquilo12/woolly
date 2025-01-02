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

interface Chat {
	id: string;
	title: string;
	created_at: string;
}

export function Sidebar() {
	const router = useRouter();
	const [chats, setChats] = useState<Chat[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState("");
	const { isOpen, toggle } = useSidebar();
	const sidebarRef = useRef<HTMLDivElement>(null);

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

	useClickOutside(sidebarRef, () => {
		if (isOpen && !document.querySelector('button:hover')) {
			toggle();
		}
	});

	const containerVariants = {
		hidden: {
			opacity: 0
		},
		visible: {
			opacity: 1,
			transition: {
				duration: 0.2, // Controls how long the fade-in takes (in seconds)
			}
		},
		exit: {
			opacity: 0,
			transition: {
				duration: 0.15 // Slightly faster fade-out
			}
		}
	};

	const contentVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				delay: 0.1, // Slight delay before content appears
				duration: 0.2,
				staggerChildren: 0.05 // Controls delay between each child animation
			}
		}
	};

	const itemVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				duration: 0.2
			}
		}
	};

	return (
		<AnimatePresence mode="wait">
			{isOpen && (
				<motion.div
					ref={sidebarRef}
					variants={containerVariants}
					initial="hidden"
					animate="visible"
					exit="exit"
					className="fixed inset-y-0 left-0 w-64 bg-background/60 backdrop-blur-lg border-r pb-12 overflow-hidden z-10"
				>
					<motion.div
						className="flex flex-col h-full px-4"
						variants={contentVariants}
						initial="hidden"
						animate="visible"
					>
						<motion.div
							className={cn(
								"flex-1 overflow-auto py-4",
								chats.length <= 3 ? "flex flex-col justify-center" : ""
							)}
						>
							<div className="space-y-4">
								<motion.div
									variants={itemVariants}
								>
									<Button
										onClick={createNewChat}
										className="w-full justify-center"
										variant="outline"
									>
										<PlusIcon className="mr-2 h-4 w-4" />
										New Chat
									</Button>
								</motion.div>

								<div className="space-y-3">
									{chats.map((chat) => (
										<motion.div
											key={chat.id}
											variants={itemVariants}
											className="group relative"
										>
											{editingId === chat.id ? (
												<div className="flex justify-center w-full">
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
														className="w-full px-3 py-2 text-sm bg-transparent border rounded text-center focus:outline-none focus:ring-2 focus:ring-ring"
														autoFocus
													/>
												</div>
											) : (
												<div className="relative rounded-md hover:bg-muted group/item">
													<Link
														href={`/chat/${chat.id}`}
														className="flex items-center justify-center min-h-[44px] w-full px-3 py-2 text-sm"
														onClick={() => setEditingTitle(chat.title)}
													>
														<span className="text-center truncate px-8">{chat.title}</span>
													</Link>

													{/* Action buttons without tooltips */}
													<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
														<Button
															variant="ghost"
															size="sm"
															className="h-7 w-7 p-0 opacity-70 hover:opacity-100"
															onClick={(e) => {
																e.preventDefault();
																e.stopPropagation();
																setEditingId(chat.id);
																setEditingTitle(chat.title);
															}}
														>
															<PencilIcon className="h-3.5 w-3.5" />
														</Button>

														<Button
															variant="ghost"
															size="sm"
															className="h-7 w-7 p-0 text-destructive opacity-70 hover:opacity-100 hover:bg-destructive/10"
															onClick={(e) => {
																e.preventDefault();
																e.stopPropagation();
																deleteChat(chat.id);
															}}
														>
															<TrashIcon className="h-3.5 w-3.5" />
														</Button>
													</div>
												</div>
											)}
										</motion.div>
									))}
								</div>
							</div>
						</motion.div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
} 