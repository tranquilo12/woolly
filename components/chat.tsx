"use client";

import { useChat } from "ai/react";
import { Message } from "ai";
import { MultimodalInput } from "./multimodal-input";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useState, useEffect, memo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ToolInvocationDisplay } from "./tool-invocation";
import { Markdown } from "./markdown";

interface ChatProps {
  chatId?: string;
}

// Memoized Message component to prevent unnecessary re-renders
const ChatMessage = memo(({ message }: { message: Message }) => (
  <motion.div
    key={message.id}
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className={cn(
      "p-4 rounded-lg max-w-[80%] whitespace-pre-wrap transition-all duration-200 ease-in-out",
      "message-content",
      message.role === "user"
        ? "bg-primary/10 ml-auto text-right"
        : "bg-muted mr-auto",
      message.role === "assistant"
        ? "prose dark:prose-invert"
        : null
    )}
  >
    <Markdown>{message.content}</Markdown>
    {message.toolInvocations?.map((tool, i) => (
      <ToolInvocationDisplay key={i} toolInvocation={tool} />
    ))}
  </motion.div>
));
ChatMessage.displayName = 'ChatMessage';

export function Chat({ chatId }: ChatProps) {
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [containerRef, endRef] = useScrollToBottom<HTMLDivElement>();

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

  const {
    messages,
    input,
    handleSubmit,
    append,
    stop,
    setMessages,
    setInput,
    isLoading: isChatLoading,
  } = useChat({
    api: chatId ? `/api/chat/${chatId}` : "/api/chat",
    id: chatId,
    initialMessages,
    streamProtocol: "data",
    onFinish: async (message) => {
      try {
        await saveMessage(message);
      } catch (error) {
        console.error('Error in onFinish:', error);
        toast.error('Failed to save or refresh messages');
      }
    },
  });

  return (
    <div className="flex flex-col w-full h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 pb-36 message-container"
      >
        <div className="flex flex-col w-full gap-4 py-4">
          {messages.map((message: Message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          <div ref={endRef} className="h-px w-full" />
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
