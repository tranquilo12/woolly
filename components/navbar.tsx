"use client";

import { cn } from "@/lib/utils";
import { MenuIcon, PenIcon } from "./icons";
import { Button } from "./ui/button";
import { useSidebar } from "./sidebar-provider";
import { useChatTitle } from "./chat-title-context";
import { useChatList } from "./chat-list-context";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

export function Navbar() {
  const { toggle } = useSidebar();
  const { title, setTitle } = useChatTitle();
  const { refreshChats } = useChatList();
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(title);
  const [isTitleLoading, setIsTitleLoading] = useState(true);
  const pathname = usePathname();
  const chatId = pathname?.split("/").pop();

  useEffect(() => {
    const fetchTitle = async () => {
      if (!chatId) {
        setIsTitleLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/chats`);
        if (!response.ok) throw new Error('Failed to fetch chats');
        const chats = await response.json();
        const currentChat = chats.find((chat: any) => chat.id === chatId);
        if (currentChat?.title) {
          setTitle(currentChat.title);
          setEditingTitle(currentChat.title);
        }
      } catch (error) {
        console.error('Failed to fetch chat title:', error);
      } finally {
        setIsTitleLoading(false);
      }
    };

    fetchTitle();
  }, [chatId, setTitle]);

  const handleTitleUpdate = async (newTitle: string) => {
    if (!chatId || !newTitle.trim()) {
      console.log("Invalid chatId or title", { chatId, newTitle });
      return;
    }

    try {
      console.log("Updating title...", { chatId, newTitle });
      const response = await fetch(`/api/chat/${chatId}/title`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Title update failed:", error);
        throw new Error("Failed to update chat title");
      }

      const data = await response.json();
      console.log("Title updated successfully:", data);

      setTitle(newTitle.trim());
      refreshChats();
      setIsEditing(false);
    } catch (error) {
      console.error("Title update error:", error);
      toast.error("Failed to update chat title");
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      console.log("Enter pressed, updating title...", editingTitle);
      await handleTitleUpdate(editingTitle);
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditingTitle(title);
    }
  };

  return (
    <header className="sticky top-0 z-50 flex items-center w-full h-16 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden absolute left-4"
        onClick={toggle}
        data-sidebar-toggle
      >
        <MenuIcon />
      </Button>
      <div className="flex-1 flex justify-center items-center">
        {isTitleLoading ? (
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        ) : title && !isEditing ? (
          <div
            className="flex items-center gap-2 group cursor-pointer"
            onClick={() => setIsEditing(true)}
          >
            <h1 className="text-lg font-semibold truncate max-w-[200px] md:max-w-[400px]">
              {title}
            </h1>
            <PenIcon size={16} />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTitleUpdate(editingTitle);
            }}
          >
            <input
              title="Chat Title"
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-transparent text-lg font-semibold text-center border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring w-[200px] md:w-[400px]"
              autoFocus
            />
          </form>
        )}
      </div>
    </header>
  );
}
