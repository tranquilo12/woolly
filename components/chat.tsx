"use client";

import { useChat } from "ai/react";
import { Message } from "ai";
import { MultimodalInput } from "./multimodal-input";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatProps {
  chatId?: string;
}

export function Chat({ chatId }: ChatProps) {
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const saveMessage = async (message: Message) => {
    if (!chatId) return;
    try {
      const response = await fetch(`/api/chat/${chatId}/messages/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) throw new Error('Failed to save message');
    } catch (error) {
      console.error('Failed to save message:', error);
      toast.error('Failed to save message');
    }
  };

  useEffect(() => {
    const fetchMessages = async () => {
      if (!chatId) return;
      try {
        const response = await fetch(`/api/chat/${chatId}/messages`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        const messages = await response.json();
        setInitialMessages(messages);
      } catch (error) {
        toast.error('Failed to load chat history');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [chatId]);

  const { messages, append, reload, stop, input, setInput, setMessages, handleSubmit } = useChat({
    api: chatId ? `/api/chat/${chatId}` : "/api/chat",
    id: chatId,
    initialMessages,
    onFinish: async (message) => {
      await saveMessage(message);
    },
  });

  const [containerRef, endRef] = useScrollToBottom<HTMLDivElement>();

  return (
    <div className="flex flex-col w-full h-[calc(100vh-4rem)]">
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col w-full max-w-4xl mx-auto p-4 gap-4">
          {messages.map((message: Message) => (
            <div
              key={message.id}
              className={cn(
                "p-4 rounded-lg",
                message.role === "user"
                  ? "bg-primary/10 ml-auto"
                  : "bg-muted"
              )}
            >
              {message.content}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="p-4 border-t">
        <div className="max-w-4xl mx-auto">
          <MultimodalInput
            chatId={chatId || ''}
            input={input}
            setInput={setInput}
            append={append}
            stop={stop}
            isLoading={isLoading}
            messages={messages}
            setMessages={setMessages}
            handleSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
