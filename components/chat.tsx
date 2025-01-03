"use client";

import { useChat } from "ai/react";
import { ChatRequestOptions, CreateMessage, Message } from "ai";
import { MultimodalInput } from "./multimodal-input";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useState, useEffect, memo, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ToolInvocationDisplay } from "./tool-invocation";
import { Markdown } from "./markdown";
import { EditMessageInput } from "./edit-message-input";
import { ThinkingMessage } from "./thinking-message";
import { EditIndicator } from "./edit-indicator";
import { ModelSelector } from "./model-selector";
import { useChatTitle } from "./chat-title-context";

interface ChatProps {
  chatId?: string;
}

interface ChatMessageProps {
  message: MessageWithModel;
  chatId: string | undefined;
  onEditComplete: (message: MessageWithModel) => void;
  onModelChange: (model: string, messageId: string) => void;
}

export interface MessageWithModel extends Message {
  model?: string;
}

export function toMessage(messageWithModel: MessageWithModel): Message {
  const { model, ...messageProps } = messageWithModel;
  return messageProps;
}

export function toMessageWithModel(message: Message, model: string = 'gpt-4o'): MessageWithModel {
  return {
    ...message,
    model,
  };
}

// Memoized Message component to prevent unnecessary re-renders
const ChatMessage = memo(({ message, chatId, onEditComplete, onModelChange }: ChatMessageProps) => {
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
      className="group relative flex items-start md:gap-6 gap-4 pb-4 w-full"
    >
      <div className="flex-1 overflow-hidden">
        <div className={cn(
          "p-4 pb-8 rounded-lg relative overflow-hidden",
          "break-words whitespace-pre-wrap",
          message.role === "user"
            ? "bg-primary/10 ml-auto max-w-[85%] float-right clear-both"
            : "bg-muted mr-auto max-w-[85%] float-left clear-both"
        )}>
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <Markdown>{message.content}</Markdown>
          </div>
          {message.toolInvocations?.map((tool, i) => (
            <ToolInvocationDisplay key={i} toolInvocation={tool} />
          ))}
          {message.role === "user" && (
            <div className="absolute bottom-1.5 left-2 opacity-20 hover:opacity-100 transition-opacity">
              <ModelSelector
                currentModel={message.model || "gpt-4o"}
                onModelChange={(model) => onModelChange(model, message.id)}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
ChatMessage.displayName = 'ChatMessage';

export function Chat({ chatId }: ChatProps) {
  const [initialMessages, setInitialMessages] = useState<MessageWithModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestreaming, setIsRestreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isToolStreaming, setIsToolStreaming] = useState(false);
  const [containerRef, endRef] = useScrollToBottom<HTMLDivElement>();
  const { setTitle } = useChatTitle();

  // Add a debounced scroll handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      container.classList.add('is-scrolling');

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Set new timeout to remove the class
      scrollTimeout = setTimeout(() => {
        container.classList.remove('is-scrolling');
      }, 1000); // Hide scrollbar after 1 second of no scrolling
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, []);

  // Force scroll on message changes

  const saveMessage = async (message: MessageWithModel) => {
    if (!chatId) return;
    try {
      const messageToSave = {
        role: message.role,
        content: message.content,
        model: message.model,
        toolInvocations: message.toolInvocations
          ? message.toolInvocations.map(tool => ({
            state: tool.state,
            toolCallId: tool.toolCallId,
            toolName: tool.toolName,
            args: tool.args,
          }))
          : null
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
    append: vercelAppend,
    stop,
    setMessages: setVercelMessages,
    setInput,
    isLoading: isChatLoading,
  } = useChat({
    api: chatId ? `/api/chat/${chatId}` : "/api/chat",
    id: chatId,
    initialMessages: initialMessages.map(toMessage),
    streamProtocol: "data",
    onFinish: async (message) => {
      try {
        const messageWithModel = toMessageWithModel(message);
        await saveMessage(messageWithModel);
        setIsRestreaming(false);
        setIsThinking(false);
      } catch (error) {
        console.error('Error in onFinish:', error);
        toast.error('Failed to save or refresh messages');
      }
    },
  });

  // Create a wrapped append function that handles MessageWithModel
  const append = async (
    message: MessageWithModel | CreateMessage,
    options?: ChatRequestOptions
  ) => {
    return vercelAppend(toMessage(message as MessageWithModel), options);
  };

  // Create a wrapped setMessages function
  const setMessages = (
    messages: MessageWithModel[] | ((prev: MessageWithModel[]) => MessageWithModel[])
  ) => {
    if (typeof messages === 'function') {
      setVercelMessages((prev) =>
        messages(prev.map(message => toMessageWithModel(message, undefined)))
          .map(toMessage)
      );
    } else {
      setVercelMessages(messages.map(toMessage));
    }
  };

  useEffect(() => {
    const end = endRef.current;
    if (end && (isLoading || isThinking || isRestreaming)) {
      end.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isThinking, isRestreaming]);

  // Update thinking state when chat loading state changes
  useEffect(() => {
    const shouldShowThinking = () => {
      if (!isChatLoading) return false;
      if (messages.length === 0) return true;

      const lastMessage = messages[messages.length - 1];
      const hasActiveToolInvocations = lastMessage.toolInvocations?.some(
        tool => tool.state === 'partial-call' || tool.state === 'call'
      );

      const isEmptyAssistantMessage = lastMessage.role === 'assistant' && !lastMessage.content;
      const isStreamStarting = lastMessage.role === 'assistant' && lastMessage.content === '';

      setIsToolStreaming(hasActiveToolInvocations || isStreamStarting);
      return isEmptyAssistantMessage || isStreamStarting || hasActiveToolInvocations;
    };

    setIsThinking(shouldShowThinking() || isToolStreaming);
  }, [isChatLoading, messages, isToolStreaming]);

  const handleEditComplete = useCallback(async (editedMessage: MessageWithModel) => {
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

      // Send selectedModel with the re-submission
      await append(
        {
          role: 'user',
          content: editedMessage.content,
        },
        {
          body: {
            messages: messagesToResend,
            model: editedMessage.model || "gpt-4o",
          },
        }
      );

    } catch (error) {
      console.error('Failed to restream messages:', error);
      toast.error('Failed to continue conversation after edit');
      setIsRestreaming(false);
    }
  }, [chatId, messages, setMessages, append]);

  const handleModelChange = async (model: string, messageId: string) => {
    // Update the message's model in the database
    const response = await fetch(`/api/chat/${chatId}/messages/${messageId}/model`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model }),
    });

    if (!response.ok) {
      toast.error('Failed to update message model');
      return;
    }

    // Update local state
    setMessages(messages.map(msg =>
      msg.id === messageId ? { ...msg, model } : msg
    ));
  };

  const renderMessage = useCallback((message: MessageWithModel) => {
    if (message.id === 'edit-indicator') {
      return <EditIndicator key="edit-indicator" />;
    }

    return (
      <ChatMessage
        key={message.id}
        message={message}
        chatId={chatId}
        onEditComplete={handleEditComplete}
        onModelChange={handleModelChange}
      />
    );
  }, [chatId, handleEditComplete, handleModelChange]);

  useEffect(() => {
    const fetchChatTitle = async () => {
      if (!chatId) return;
      try {
        const response = await fetch(`/api/chats`);
        if (!response.ok) throw new Error('Failed to fetch chats');
        const chats = await response.json();
        const currentChat = chats.find((chat: any) => chat.id === chatId);
        if (currentChat?.title) {
          setTitle(currentChat.title);
        }
      } catch (error) {
        console.error('Failed to fetch chat title:', error);
      }
    };

    fetchChatTitle();
    return () => setTitle('');
  }, [chatId, setTitle]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Message container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto message-container"
      >
        <div className="flex flex-col w-full gap-4 px-4 py-4">
          {messages.map(renderMessage)}
          {(isLoading || (isThinking && isToolStreaming)) && (
            <ThinkingMessage isToolStreaming={isToolStreaming} />
          )}
          <div ref={endRef} className="h-px w-full" />
        </div>
      </div>

      {/* Input container - fixed at bottom */}
      <div className="sticky bottom-0 w-full bg-background border-t">
        <div className="max-w-3xl mx-auto">
          <MultimodalInput
            chatId={chatId || ""}
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            stop={stop}
            messages={messages}
            setMessages={setMessages}
            append={append}
            handleSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
