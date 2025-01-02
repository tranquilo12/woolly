"use client";

import { useChat } from "ai/react";
import { ChatRequestOptions, Message } from "ai";
import { MultimodalInput } from "./multimodal-input";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ToolInvocationDisplay } from "./tool-invocation";
import { ThinkingMessage } from "./thinking-message";

interface ChatProps {
  chatId?: string;
}

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
    onFinish: async (message) => {
      try {
        await saveMessage(message);
      } catch (error) {
        console.error('Error in onFinish:', error);
        toast.error('Failed to save or refresh messages');
      }
    },
  });

  const handleSubmitWithThinking = async (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions,
  ) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    // Create and append the user's message first, which will return the assistant's message ID
    const assistantMessageId = await append(
      {
        role: "user",
        content: input,
      },
      chatRequestOptions
    );

    // If we got an ID back, create our placeholder assistant message
    if (assistantMessageId) {
      setMessages(messages => [
        ...messages,
        {
          id: assistantMessageId,
          content: "",
          role: "assistant",
          createdAt: new Date(),
        },
      ]);
    }
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 pb-36">
        <div className="flex flex-col w-full gap-4 py-4">
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
            handleSubmit={handleSubmitWithThinking}
          />
        </div>
      </div>
    </div>
  );
}
