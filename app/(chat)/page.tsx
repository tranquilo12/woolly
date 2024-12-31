"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

export default function Page() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          await signOut({ callbackUrl: '/auth/signin' });
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to create chat');
        }

        console.log("Created chat with ID:", data.id);
        router.push(`/chat/${data.id}`);
      } catch (error) {
        console.error("Error creating chat:", error);
        setError("Failed to create chat. Please try again.");
        toast.error("Failed to create chat");
      } finally {
        setIsLoading(false);
      }
    };

    createChat();
  }, [router]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4">
        <div className="text-red-500">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-blue-500 hover:underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
        <div>Creating new chat...</div>
      </div>
      <div className="text-sm text-gray-500">
        This may take a few seconds
      </div>
    </div>
  );
}