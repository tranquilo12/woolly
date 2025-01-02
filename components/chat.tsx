"use client";

import { useChat } from "ai/react";
import { Message } from "ai";
import { MultimodalInput } from "./multimodal-input";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useState, useEffect, memo, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ToolInvocationDisplay } from "./tool-invocation";
import { Markdown } from "./markdown";
import { Button } from "./ui/button";
import { EditMessageInput } from "./edit-message-input";
import { ThinkingMessage } from "./thinking-message";
import { EditIndicator } from "./edit-indicator";

interface ChatProps {
  chatId?: string;
}

interface ChatMessageProps {
  message: Message;
  chatId: string | undefined;
  onEditComplete: (message: Message) => void;
}

// Memoized Message component to prevent unnecessary re-renders
const ChatMessage = memo(({ message, chatId, onEditComplete }: ChatMessageProps) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = async (newContent: string) => {
    if (!chatId || !message.id) return;
    try {
      const response = await fetch(`/api/chat/${chatId}/messages/${message.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newContent }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Edit error:', errorData);
        throw new Error('Failed to edit message');
      }

      const updatedMessage = { ...message, content: newContent };
      onEditComplete(updatedMessage);
      setIsEditing(false);
    } catch (error) {
      console.error('Edit error:', error);
      toast.error('Failed to edit message');
    }
  };

  if (isEditing) {
    return (
      <EditMessageInput
        initialContent={message.content}
        onSave={handleEdit}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "group relative flex items-start md:gap-6 gap-4 pb-4",
        message.role === "user"
          ? "flex-row-reverse"
          : "flex-row"
      )}
    >
      <div className="flex-1">
        <div className={cn(
          "p-4 rounded-lg max-w-[80%]",
          message.role === "user"
            ? "bg-primary/10 ml-auto"
            : "bg-muted mr-auto"
        )}>
          <Markdown>{message.content}</Markdown>
          {message.toolInvocations?.map((tool, i) => (
            <ToolInvocationDisplay key={i} toolInvocation={tool} />
          ))}
        </div>
        {message.role === "user" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2"
          >
            Edit
          </Button>
        )}
      </div>
    </motion.div>
  );
});
ChatMessage.displayName = 'ChatMessage';

export function Chat({ chatId }: ChatProps) {
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestreaming, setIsRestreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
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
        setIsRestreaming(false);
        setIsThinking(false);
      } catch (error) {
        console.error('Error in onFinish:', error);
        toast.error('Failed to save or refresh messages');
      }
    },
  });

  // Update thinking state when chat loading state changes
  useEffect(() => {
    if (isChatLoading && messages.length === 0) {
      setIsThinking(true);
    } else if (isChatLoading && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Only show thinking if the last message is empty (hasn't started streaming)
      setIsThinking(lastMessage.role === 'assistant' && !lastMessage.content);
    } else {
      setIsThinking(false);
    }
  }, [isChatLoading, messages]);

  const handleEditComplete = useCallback(async (editedMessage: Message) => {
    if (!chatId) return;
    setIsRestreaming(true);

    try {
      const messageIndex = messages.findIndex(m => m.id === editedMessage.id);
      const previousMessages = messages.slice(0, messageIndex + 1);

      // Update the messages state to show only up to the edited message
      setMessages([
        ...previousMessages.map(m => m.id === editedMessage.id ? editedMessage : m),
        { id: 'edit-indicator', role: 'system', content: '' }
      ]);

      // Get all messages up to the edited one for the API
      const messagesToResend = previousMessages.map(m => ({
        role: m.role,
        content: m.id === editedMessage.id ? editedMessage.content : m.content,
        id: m.id
      }));

      // Trigger a new stream with these messages
      await append({
        role: 'user',
        content: editedMessage.content,
      }, {
        body: {
          messages: messagesToResend
        }
      });

    } catch (error) {
      console.error('Failed to restream messages:', error);
      toast.error('Failed to continue conversation after edit');
      setIsRestreaming(false);
    }
  }, [chatId, messages, setMessages, append, setIsRestreaming]);

  const renderMessage = useCallback((message: Message) => {
    if (message.id === 'edit-indicator') {
      return <EditIndicator key="edit-indicator" />;
    }

    return (
      <ChatMessage
        key={message.id}
        message={message}
        chatId={chatId}
        onEditComplete={handleEditComplete}
      />
    );
  }, [chatId, handleEditComplete]);

  return (
    <div className="flex flex-col w-full h-[calc(100vh-4rem)] max-w-4xl mx-auto relative">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 pb-36 message-container"
      >
        <div className="flex flex-col w-full gap-4 py-4">
          {messages.map(renderMessage)}
          {(isLoading || isThinking || isRestreaming) && <ThinkingMessage />}
          <div ref={endRef} className="h-px w-full" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-sm">
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
