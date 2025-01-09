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
import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { TokenCount } from "./token-count";

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
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
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

  const messageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  };

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
      <motion.div
        variants={messageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <EditMessageInput
          initialContent={message.content}
          onSave={handleEdit}
          onCancel={() => setIsEditing(false)}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group relative w-full max-w-3xl mx-auto transition-all duration-300",
        message.role === "user"
          ? "mb-8 hover:bg-muted/30 hover:shadow-muted/20 rounded-lg hover:translate-x-1"
          : "mb-8 hover:bg-primary/5 hover:shadow-primary/10 rounded-lg hover:-translate-x-1",
      )}
    >
      <div className="flex items-start gap-4 px-4 py-4">
        <div className={cn(
          "min-w-[30px] text-sm font-medium transition-colors duration-300",
          message.role === "user"
            ? "text-muted-foreground group-hover:text-foreground"
            : "text-muted-foreground group-hover:text-primary"
        )}>
          {message.role === "user" ? "You" : "AI"}
        </div>

        <motion.div
          className="flex-1 space-y-4 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="prose dark:prose-invert">
            <Markdown>{message.content}</Markdown>
          </div>

          {message.toolInvocations?.map((tool, i) => (
            <ToolInvocationDisplay key={i} toolInvocation={tool} />
          ))}

          <TokenCount
            prompt_tokens={message.prompt_tokens}
            completion_tokens={message.completion_tokens}
            total_tokens={message.total_tokens}
            isLoading={message.role === 'assistant' && !message.total_tokens}
          />
        </motion.div>

        {message.role === "user" && (
          <motion.div
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ModelSelector
              currentModel={message.model || "gpt-4o"}
              onModelChange={(model) => onModelChange(model, message.id)}
            />
          </motion.div>
        )}
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
  const [containerRef, endRef, scrollToBottom] = useScrollToBottom<HTMLDivElement>();
  const { setTitle } = useChatTitle();
  const {
    searchRepository,
    getRepositoryStats,
    getRepositoryMap,
    getRepositorySummary
  } = useRepositoryStatus();
  const [codeContextBlocks, setCodeContextBlocks] = useState<Array<{
    language: string;
    value: string;
    filePath?: string;
  }>>([]);

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
  }, [chatId, containerRef, endRef]);

  // Scroll during streaming
  useEffect(() => {
    if (isThinking || isToolStreaming) {
      scrollToBottom({ behavior: 'smooth' });
    }
  }, [isThinking, isToolStreaming, scrollToBottom]);

  const saveMessage = async (message: MessageWithModel) => {
    if (!chatId) return;
    try {
      const messageToSave = {
        role: message.role,
        content: message.content,
        model: message.model,
        prompt_tokens: message.prompt_tokens,
        completion_tokens: message.completion_tokens,
        total_tokens: message.total_tokens,
        toolInvocations: message.toolInvocations
          ? message.toolInvocations.map(tool => ({
            state: tool.state,
            toolCallId: tool.toolCallId,
            toolName: tool.toolName,
            args: tool.args,
            result: tool.state === 'result' ? tool.result : undefined
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
    body: {
      id: chatId
    },
    onResponse: (response) => {
      if (!response.ok) {
        console.error('Stream response error:', response.status);
        toast.error('Error in chat response');
      }
    },
    onFinish: async (message, usage) => {
      try {
        const messageWithModel = toMessageWithModel(message);

        // Restore token counting
        if (usage?.usage) {
          messageWithModel.prompt_tokens = usage.usage.promptTokens;
          messageWithModel.completion_tokens = usage.usage.completionTokens;
          messageWithModel.total_tokens = usage.usage.totalTokens;
        }

        await saveMessage(messageWithModel);
        setIsRestreaming(false);
        setIsThinking(false);
      } catch (error) {
        console.error('Error in onFinish:', error);
        toast.error('Failed to save message');
      }
    },
  });

  // Scroll on new message
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      // Only force scroll when user sends a message
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        scrollToBottom({ behavior: 'smooth' });
      }
    }
  }, [isLoading, messages, scrollToBottom]);

  // Create a wrapped append function that handles MessageWithModel
  const append = useCallback(async (
    message: MessageWithModel | CreateMessage,
    options?: ChatRequestOptions
  ) => {
    return vercelAppend(toMessage(message as MessageWithModel), options);
  }, [vercelAppend]);

  // Create a wrapped setMessages function
  const setMessages = useCallback((
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
  }, [setVercelMessages]);

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
      scrollToBottom({ force: true, behavior: 'auto' });

    } catch (error) {
      console.error('Failed to restream messages:', error);
      toast.error('Failed to continue conversation after edit');
      setIsRestreaming(false);
    }
  }, [chatId, messages, setMessages, append, scrollToBottom]);

  const handleModelChange = useCallback(async (model: string, messageId: string) => {
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
  }, [chatId, setMessages, messages]);


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

  const updateCodeContext = useCallback((blocks: Array<{
    language: string;
    value: string;
    filePath?: string;
  }>) => {
    setCodeContextBlocks(blocks);
  }, []);

  const handleCodeContextUpdate = useCallback((message: MessageWithModel) => {
    // Extract code blocks from message content
    const codeBlocks = message.content.match(/```[\s\S]*?```/g) || [];

    const parsedBlocks = codeBlocks.map(block => {
      const [firstLine, ...rest] = block.split('\n');
      const language = firstLine.replace('```', '').trim();
      const value = rest.slice(0, -1).join('\n');

      // Extract file path if present (format: ```language:filepath)
      const [lang, filePath] = language.split(':');

      return {
        language: lang,
        value,
        filePath
      };
    });

    updateCodeContext(parsedBlocks);
  }, [updateCodeContext]);

  useEffect(() => {
    // Only process the last assistant message for code blocks
    const lastAssistantMessage = [...messages]
      .reverse()
      .find(msg => msg.role === 'assistant');

    if (lastAssistantMessage) {
      handleCodeContextUpdate(lastAssistantMessage);
    }
  }, [messages, handleCodeContextUpdate]);

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

  // Debug streaming state
  useEffect(() => {
    console.log('Streaming state:', {
      isThinking,
      isToolStreaming,
      isChatLoading
    });
  }, [isThinking, isToolStreaming, isChatLoading]);

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
            chatId={chatId || ''}
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            stop={stop}
            messages={messages}
            setMessages={setMessages}
            append={append}
            handleSubmit={handleSubmit}
            searchRepository={searchRepository}
          />
        </div>
      </div>
    </div>
  );
}
