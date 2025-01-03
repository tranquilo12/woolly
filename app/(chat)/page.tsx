"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useChatList } from "@/components/chat-list-context";

export default function Page() {
  const router = useRouter();
  const { refreshChats } = useChatList();

  useEffect(() => {
    const createChat = async () => {
      try {
        console.log("Attempting to create chat...");
        const response = await fetch("/api/chat/create", {
          method: "POST",
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", errorText);
          throw new Error(`Failed to create chat: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log("Created chat with ID:", data.id);

        router.push(`/chat/${data.id}`);
        refreshChats();

      } catch (error) {
        console.error("Error creating chat:", error);
      }
    };

    createChat();
  }, [router, refreshChats]);

  return (
    <div className="flex items-center justify-center h-screen flex-col gap-4">
      <div>Creating new chat...</div>
      <div className="text-sm text-gray-500">
        (Check browser console for debugging information)
      </div>
    </div>
  );
}