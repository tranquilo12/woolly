"use client";

import { useChat } from "ai/react";
import { Message } from "ai";
import { MultimodalInput } from "./multimodal-input";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ToolInvocationDisplay } from "./tool-invocation";

interface ChatProps {
  chatId: string;
  userId: string;
}

export function Chat({ chatId, userId }: ChatProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);

  const saveMessage = async (message: Message) => {
    if (!chatId) return;
    try {
      const messageToSave = {
        role: message.role,
        content: message.content,
        toolInvocations: message.toolInvocations || null,
        userId,
      };

      const response = await fetch(`/api/chat/${chatId}/messages/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageToSave),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save message error:', errorText);
        throw new Error('Failed to save message');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to save message:', error);
      toast.error('Failed to save message');
      throw error;
    }
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        if (!chatId) return;
        const response = await fetch(`/api/chat/${chatId}/messages?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        const data = await response.json();
        setInitialMessages(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to load messages');
        setInitialMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [chatId, userId]);

  const { messages = [], append, stop, input, setInput, setMessages, handleSubmit } = useChat({
    api: chatId ? `/api/chat/${chatId}` : "/api/chat",
    id: chatId,
    initialMessages,
    body: { userId },
    onFinish: async (message) => {
      try {
        await saveMessage(message);
        const response = await fetch(`/api/chat/${chatId}/messages?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to refresh messages');
        const refreshedMessages = await response.json();
        setMessages(Array.isArray(refreshedMessages) ? refreshedMessages : []);
      } catch (error) {
        console.error('Error in onFinish:', error);
        toast.error('Failed to save or refresh messages');
      }
    },
  });

  const [containerRef, endRef] = useScrollToBottom<HTMLDivElement>();

  if (isLoading) {
    return (
      <div className="flex flex-col w-full h-[calc(100vh-4rem)] max-w-4xl mx-auto">
        <div className="flex-1 overflow-y-auto px-4 pb-36">
          <div className="flex flex-col w-full gap-4 py-4">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className={cn(
                  "p-4 rounded-lg max-w-[80%]",
                  i % 2 === 0 ? "ml-auto" : "mr-auto"
                )}
              >
                <div className="animate-pulse">
                  <div className="h-4 bg-primary/10 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-primary/10 rounded w-1/2"></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="border-t fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto p-4">
            <div className="animate-pulse">
              <div className="h-10 bg-primary/10 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      <div className="flex-1 overflow-y-auto px-4 pb-36">
        <div className="flex flex-col w-full gap-4 py-4">
          {Array.isArray(messages) && messages.length > 0 ? (
            messages.map((message: Message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "p-4 rounded-lg max-w-[80%]",
                  message.role === "user" ? "ml-auto" : "mr-auto"
                )}
              >
                {message.content}
                {message.toolInvocations?.map((tool, i) => (
                  <ToolInvocationDisplay key={i} toolInvocation={tool} />
                ))}
              </motion.div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-8">
              No messages yet. Start a conversation!
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm">
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
