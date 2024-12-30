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
  chatId?: string;
}

export function Chat({ chatId }: ChatProps) {
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const saveMessage = async (message: Message) => {
    if (!chatId) return;
    try {
      const messageToSave = {
        role: message.role,
        content: message.content,
        toolInvocations: message.toolInvocations || null
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

  const { messages, append, stop, input, setInput, setMessages, handleSubmit } = useChat({
    api: chatId ? `/api/chat/${chatId}` : "/api/chat",
    id: chatId,
    initialMessages,
    onFinish: async (message) => {
      try {
        await saveMessage(message);
        const response = await fetch(`/api/chat/${chatId}/messages`);
        if (!response.ok) throw new Error('Failed to refresh messages');
        const refreshedMessages = await response.json();
        setMessages(refreshedMessages);
      } catch (error) {
        console.error('Error in onFinish:', error);
        toast.error('Failed to save or refresh messages');
      }
    },
  });

  const [containerRef, endRef] = useScrollToBottom<HTMLDivElement>();

  return (
    <div className="flex flex-col w-full h-[calc(100vh-4rem)]">
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col w-full max-w-4xl mx-auto p-4 gap-4">
          {messages.map((message: Message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "p-4 rounded-lg max-w-[80%] whitespace-pre-wrap",
                message.role === "user"
                  ? "bg-primary/10 ml-auto text-right"
                  : "bg-muted mr-auto",
                message.role === "assistant"
                  ? "prose dark:prose-invert"
                  : null
              )}
            >
              {message.content}
              {message.toolInvocations?.map((tool, i) => (
                <ToolInvocationDisplay key={i} toolInvocation={tool} />
              ))}
            </motion.div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t p-4 sticky bottom-0 bg-background">
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
