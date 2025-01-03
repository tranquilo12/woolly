"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { PlusIcon, TrashIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
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
	const { isOpen, toggle, setIsOpen } = useSidebar();
	const sidebarRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);

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
		const toggleButton = document.querySelector('[data-sidebar-toggle]');
		if (isOpen && !toggleButton?.contains(document.activeElement)) {
			setIsOpen(false);
		}
	});

	const handleToggleClick = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		toggle();
	}, [toggle]);

	useEffect(() => {
		const handleScroll = () => {
			if (scrollContainerRef.current) {
				const isScrolling = scrollContainerRef.current.scrollTop > 0;
				scrollContainerRef.current.classList.toggle('overflow-visible', isScrolling);
			}
		};

		const scrollContainer = scrollContainerRef.current;
		if (scrollContainer) {
			scrollContainer.addEventListener('scroll', handleScroll);
			return () => scrollContainer.removeEventListener('scroll', handleScroll);
		}
	}, []);

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
		<AnimatePresence>
			{isOpen && (
				<motion.div
					ref={sidebarRef}
					initial="hidden"
					animate="visible"
					exit="exit"
					variants={containerVariants}
					className={cn(
						"fixed left-0 top-0 z-50 flex h-full w-full flex-col border-l bg-background/80 backdrop-blur-xl sm:w-[400px]",
						"border-muted/30 shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(0,0,0,0.2)]",
					)}
					data-sidebar
				>
					<motion.div
						className="flex flex-col h-full items-center justify-center"
						variants={contentVariants}
						initial="hidden"
						animate="visible"
					>
						<div className="w-full max-h-[70vh] flex flex-col items-center gap-6">
							<h2 className="text-lg font-semibold text-foreground">Chat History</h2>

							<div ref={scrollContainerRef} className="w-full px-4 overflow-auto sidebar-scroll">
								<div className="rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm">
									<div className="p-2 space-y-2">
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
							</div>

							<div className="w-full px-4">
								<Button
									onClick={() => router.push('/')}
									className="w-full justify-center"
									variant="ghost"
								>
									<PlusIcon className="mr-2" size={16} />
									New Chat
								</Button>
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
} 