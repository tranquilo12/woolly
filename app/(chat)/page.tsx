"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const createChat = async () => {
      try {
        console.log("Attempting to create chat...");
        const response = await fetch("/api/chat/create", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            messages: []
          })
        });

        if (response.status === 401) {
          // Handle unauthorized - sign out and redirect to login
          await signOut({ callbackUrl: '/auth/signin' });
          return;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", errorText);
          throw new Error(`Failed to create chat: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log("Created chat with ID:", data.id);

        router.push(`/chat/${data.id}`);
      } catch (error) {
        console.error("Error creating chat:", error);
      }
    };

    createChat();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen flex-col gap-4">
      <div>Creating new chat...</div>
      <div className="text-sm text-gray-500">
        (Check browser console for debugging information)
      </div>
    </div>
  );
}