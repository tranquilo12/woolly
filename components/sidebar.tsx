"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "./ui/button";
import { PlusIcon, TrashIcon, PenIcon, Pin, PinOff, MenuIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback, RefObject } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "./sidebar-provider";
import { useClickOutside } from '@/hooks/use-click-outside';
import { cn } from "@/lib/utils";
import { useChatList } from "./chat-list-context";
import { RepositorySection } from "./repository-section";
import { Separator } from "@radix-ui/react-select";

interface Chat {
	id: string;
	title: string;
	created_at: string;
}

export function Sidebar() {
	const router = useRouter();
	const pathname = usePathname();
	const [chats, setChats] = useState<Chat[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState("");
	const { isOpen, toggle, setIsOpen, isPinned, setIsPinned } = useSidebar();
	const sidebarRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const { refreshChats } = useChatList();
	const [isNavigating, setIsNavigating] = useState(false);
	const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

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

			fetchChats();
			setEditingId(null);
			refreshChats();
		} catch (error) {
			toast.error("Failed to update chat title");
		}
	};

	useClickOutside(sidebarRef as RefObject<HTMLElement>, () => {
		if (isOpen && !isPinned) {
			setIsOpen(false);
		}
	});

	const handleToggleClick = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (isOpen && !isPinned) {
			setIsOpen(false);
		} else if (!isPinned) {
			toggle();
		}
	}, [toggle, isOpen, isPinned, setIsOpen]);

	useEffect(() => {
		const sidebarElement = sidebarRef.current;
		if (!sidebarElement) return;

		let scrollTimeout: NodeJS.Timeout;

		const handleScroll = () => {
			sidebarElement.classList.add('is-scrolling');

			// Clear the existing timeout
			if (scrollTimeout) {
				clearTimeout(scrollTimeout);
			}

			// Set a new timeout to remove the class
			scrollTimeout = setTimeout(() => {
				sidebarElement.classList.remove('is-scrolling');
			}, 1000); // Hide scrollbar after 1 second of no scrolling
		};

		sidebarElement.addEventListener('scroll', handleScroll);

		return () => {
			sidebarElement.removeEventListener('scroll', handleScroll);
			if (scrollTimeout) {
				clearTimeout(scrollTimeout);
			}
		};
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

	const handleChatClick = useCallback(async (e: React.MouseEvent, chatId: string) => {
		e.preventDefault();
		e.stopPropagation();

		if (isNavigating || selectedChatId === chatId || pathname === `/chat/${chatId}`) return;

		try {
			setIsNavigating(true);
			setSelectedChatId(chatId);

			// Force a hard navigation
			window.location.href = `/chat/${chatId}`;

		} catch (error) {
			console.error('Navigation error:', error);
			toast.error('Failed to navigate to chat');
			setIsNavigating(false);
			setSelectedChatId(null);
		}
	}, [isNavigating, selectedChatId, pathname]);

	return (
		<div className="sidebar-container relative">
			<button
				title="Toggle Sidebar"
				onClick={handleToggleClick}
				className={cn(
					"sidebar-toggle fixed left-4 top-[calc(var(--navbar-height)+1rem)] z-50",
					"h-8 w-8 flex items-center justify-center",
					"rounded-md border bg-background shadow-sm",
					"hover:bg-accent/50 transition-colors duration-200"
				)}
			>
				<MenuIcon className="h-4 w-4" />
			</button>
			<AnimatePresence>
				{isOpen && (
					<motion.div
						ref={sidebarRef}
						initial="hidden"
						animate="visible"
						exit="exit"
						variants={containerVariants}
						className={cn(
							"fixed left-0 top-[var(--navbar-height)] z-50 flex h-content w-full items-center justify-center sm:w-[clamp(250px,20%,300px)]",
							"bg-background"
						)}
						data-sidebar
					>
						<motion.div
							className="flex flex-col w-full px-4 gap-4"
							variants={contentVariants}
							initial="hidden"
							animate="visible"
						>
							<div className="absolute right-0 top-1/2 translate-x-1/2 transform">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setIsPinned(!isPinned)}
									className={cn(
										"h-8 w-8 p-0 rounded-full",
										"border border-border/50",
										"bg-background/95 backdrop-blur",
										"hover:bg-muted/50 transition-colors",
										"shadow-sm hover:shadow-md",
										isPinned && "text-primary bg-muted/50"
									)}
								>
									{isPinned ? (
										<PinOff className="h-4 w-4" />
									) : (
										<Pin className="h-4 w-4" />
									)}
								</Button>
							</div>

							<div className="w-full flex-1 flex flex-col items-center gap-4">
								<h2 className="text-lg font-semibold text-foreground">Chat History</h2>
								<div
									ref={scrollContainerRef}
									className="w-full flex-1 overflow-auto sidebar-scroll rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm shadow-[0_0_15px_rgba(20,20,20,0.1)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] dark:bg-muted/20"
								>
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
															className={cn(
																"flex items-center justify-center min-h-[44px] w-full px-3 py-2 text-sm",
																selectedChatId === chat.id && "pointer-events-none opacity-50"
															)}
															onClick={(e) => handleChatClick(e, chat.id)}
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
																<PenIcon className="h-3.5 w-3.5" />
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
								<Button
									onClick={() => router.push('/')}
									className="w-full justify-center"
									variant="ghost"
								>
									<PlusIcon className="mr-2" size={16} />
									New Chat
								</Button>
								<Separator />

								<h2 className="text-lg font-semibold text-foreground">Repositories</h2>
								<div className="w-full overflow-auto sidebar-scroll rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm shadow-[0_0_15px_rgba(20,20,20,0.1)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] dark:bg-muted/20">
									<RepositorySection />
								</div>

							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
} 