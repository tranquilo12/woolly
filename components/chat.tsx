"use client";

import { useChat } from "ai/react";
import { ChatRequestOptions, CreateMessage, LanguageModelUsage, Message, tool } from "ai";
import { MultimodalInput } from "./multimodal-input";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useState, useEffect, memo, useCallback, SetStateAction, Dispatch } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ToolInvocationDisplay } from "./tool-invocation";
import { Markdown } from "./markdown";
import { EditMessageInput } from "./edit-message-input";
import { EditIndicator } from "./edit-indicator";
import { ModelSelector } from "./model-selector";
import { useChatTitle } from "./chat-title-context";
import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { TokenCount } from "./token-count";
import { MessageGroup } from "./message-group";
import { CodeContextContainer } from "./code-context-container";
import { CollapsibleCodeBlock } from "./collapsible-code-block";
import { Button } from "@/components/ui/button";
import { PencilIcon } from "lucide-react";
import { ExtendedToolCall } from "@/types/tool-calls";
import { useParameterizedChat } from "@/hooks/use-parameterized-chat";

interface ChatProps {
  chatId?: string;
}

interface ChatMessageProps {
  message: MessageWithModel;
  chatId: string | undefined;
  onEditComplete: (message: MessageWithModel) => void;
  onModelChange: (model: string, messageId: string) => void;
  isFirstUserMessage?: boolean;
}

export interface MessageWithModel extends Message {
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  data?: {
    dbId?: string;
  };
  toolInvocations?: ExtendedToolCall[];
}

export function toMessage(messageWithModel: MessageWithModel): Message {
  const { model, ...messageProps } = messageWithModel;
  return messageProps;
}

export function toMessageWithModel(
  message: Message,
  usage: LanguageModelUsage | null,
  model: string = 'gpt-4o'
): MessageWithModel {
  return {
    ...message,
    model,
    prompt_tokens: usage?.promptTokens,
    completion_tokens: usage?.completionTokens,
    total_tokens: usage?.totalTokens,
    toolInvocations: message.toolInvocations as ExtendedToolCall[],
    data: { dbId: message.id }
  };
}

// Memoized Message component to prevent unnecessary re-renders
const ChatMessage = memo(({ message, chatId, onEditComplete, onModelChange, isFirstUserMessage }: ChatMessageProps) => {
  const [isEditing, setIsEditing] = useState(false);

  const messageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  };

  // Add code block extraction logic
  const getCodeBlocks = (content: string) => {
    const codeBlockRegex = /```[\s\S]*?```/g;
    return content.match(codeBlockRegex) || [];
  };

  const codeBlocks = getCodeBlocks(message.content);
  const hasCodeContext = codeBlocks.length > 0;

  // Separate code blocks from main content
  const contentWithoutCode = message.content.replace(/```[\s\S]*?```/g, '');

  const handleEdit = async (newContent: string) => {
    if (!chatId || !message.id) return;
    try {
      // Use the database UUID from message.data if available
      const dbId = message.data?.dbId || message.id;

      const response = await fetch(`/api/chat/${chatId}/messages/${dbId}`, {
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
          {hasCodeContext && (
            <div className="mb-4">
              <CodeContextContainer codeBlockCount={codeBlocks.length} initiallyExpanded={false}>
                <div className="space-y-2">
                  {codeBlocks.map((block, index) => {
                    const language = block.split('\n')[0].replace('```', '').trim();
                    const code = block.split('\n').slice(1, -1).join('\n');
                    return (
                      <CollapsibleCodeBlock
                        key={index}
                        language={language || 'text'}
                        value={code}
                        initiallyExpanded={false}
                      />
                    );
                  })}
                </div>
              </CodeContextContainer>
            </div>
          )}

          <div className="prose dark:prose-invert">
            <Markdown>{contentWithoutCode}</Markdown>
          </div>

          {message.toolInvocations?.map((tool, index) => {
            // Create a truly unique key by combining message id, tool id, and index
            const uniqueKey = `${message.id}-${tool.toolCallId || 'tool'}-${index}`;

            return (
              <ToolInvocationDisplay
                key={uniqueKey}
                toolInvocation={{
                  id: tool.toolCallId,
                  toolCallId: tool.toolCallId,
                  toolName: tool.toolName,
                  args: tool.args,
                  state: tool.state,
                  result: 'result' in tool ? tool.result : undefined
                }}
              />
            );
          })}

          <TokenCount
            prompt_tokens={message.prompt_tokens}
            completion_tokens={message.completion_tokens}
            total_tokens={message.total_tokens}
          />
        </motion.div>

        {message.role === "user" && !isFirstUserMessage && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <motion.div
              className="transition-opacity"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 hover:bg-accent/50 transition-colors"
                onClick={() => setIsEditing(true)}
              >
                <PencilIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
            </motion.div>
            <motion.div
              className="transition-opacity"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <ModelSelector
                currentModel={message.model || "gpt-4o"}
                onModelChange={(model) => onModelChange(model, message.id)}
              />
            </motion.div>
          </div>
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
  const [containerRef, endRef, scrollToBottom] = useScrollToBottom<HTMLDivElement>();
  const { setTitle } = useChatTitle();
  const [currentModel, setCurrentModel] = useState("gpt-4o");
  const [documentationMode, setDocumentationMode] = useState<string | null>(null);

  // Memoize repository status hooks
  const {
    searchRepository,
    getRepositoryStats,
    getRepositoryMap,
    getRepositorySummary
  } = useRepositoryStatus();

  // Memoize code context state
  const [codeContextBlocks, setCodeContextBlocks] = useState<Array<{
    language: string;
    value: string;
    filePath?: string;
  }>>([]);

  // Fetch messages only when chatId changes
  useEffect(() => {
    let mounted = true;

    const fetchMessages = async () => {
      if (!chatId) return;
      try {
        const response = await fetch(`/api/chat/${chatId}/messages`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        const messages = await response.json();
        if (mounted) {
          setInitialMessages(messages);
        }
      } catch (error) {
        toast.error('Failed to load chat history');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMessages();
    return () => {
      mounted = false;
    };
  }, [chatId]);

  const {
    messages,
    isThinking,
    setIsThinking,
    input,
    setInput,
    setMessages,
    getMostCompleteToolInvocation,
    handleInputChange,
    handleSubmit,
    append,
    stop,
    isLoading: isChatLoading,
  } = useParameterizedChat({
    endpoint: chatId ? `/api/chat/${chatId}` : "/api/chat",
    chatId,
    initialMessages: initialMessages,
    body: {
      id: chatId
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
  const appendMessage = useCallback(async (
    message: MessageWithModel | CreateMessage,
    options?: ChatRequestOptions
  ) => {
    // Save user message first if it's a user message
    if (chatId && message.role === 'user') {
      try {
        await fetch(`/api/chat/${chatId}/messages/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: message.role,
            content: message.content,
            model: currentModel
          }),
        });
      } catch (error) {
        console.error('Failed to save user message:', error);
      }
    }

    return append(message, options);
  }, [append, chatId, currentModel]);

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

      return isEmptyAssistantMessage || isStreamStarting || hasActiveToolInvocations;
    };

    setIsThinking(shouldShowThinking() || isChatLoading);
  }, [isChatLoading, messages, setIsThinking]);

  const handleEditComplete = useCallback(async (editedMessage: MessageWithModel) => {
    if (!chatId) return;
    setIsRestreaming(true);

    try {
      const messageIndex = messages.findIndex(m => m.id === editedMessage.id);
      const messagesToKeep = messages.slice(0, messageIndex + 1);

      // Update the edited message in place
      messagesToKeep[messageIndex] = {
        ...messagesToKeep[messageIndex],
        content: editedMessage.content
      };

      setMessages(messagesToKeep as MessageWithModel[]);

      const options = {
        body: {
          messages: messagesToKeep.map(m => ({
            role: m.role,
            content: m.content,
            id: m.id
          })),
          model: editedMessage.model || "gpt-4o",
        },
      }

      await appendMessage(
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: ''
        } as Message,
        options
      );
      scrollToBottom({ force: true, behavior: 'auto' });
    } catch (error) {
      console.error('Failed to restream messages:', error);
      scrollToBottom({ force: true, behavior: 'auto' });
    }
  }, [appendMessage, chatId, messages, scrollToBottom, setMessages]);

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

    // Update local state with proper type casting
    setMessages((prevMessages) =>
      prevMessages.map(msg =>
        msg.id === messageId
          ? { ...msg, model } as MessageWithModel
          : msg
      )
    );
  }, [chatId, setMessages]);


  useEffect(() => {
    let mounted = true;

    const fetchChatTitle = async () => {
      if (!chatId) return;
      try {
        const response = await fetch(`/api/chats`);
        if (!response.ok) throw new Error('Failed to fetch chats');
        const chats = await response.json();
        const currentChat = chats.find((chat: any) => chat.id === chatId);
        if (currentChat?.title && mounted) {
          setTitle(currentChat.title);
        }
      } catch (error) {
        console.error('Failed to fetch chat title:', error);
      }
    };

    fetchChatTitle();
    return () => {
      mounted = false;
      setTitle('');
    };
  }, [chatId, setTitle]);


  const handleCodeContextUpdate = useCallback((message: MessageWithModel) => {
    if (!message?.content) return;

    // Extract code blocks from message content
    const codeBlocks = message.content.match(/```[\s\S]*?```/g) || [];

    const parsedBlocks = codeBlocks.map(block => {
      const [firstLine, ...rest] = block.split('\n');
      const language = firstLine.replace('```', '').trim();
      const value = rest.slice(0, -1).join('\n');

      const [lang, filePath] = language.split(':');

      return {
        language: lang,
        value,
        filePath
      };
    });

    // Only update if blocks have changed
    setCodeContextBlocks(prev => {
      const prevString = JSON.stringify(prev);
      const newString = JSON.stringify(parsedBlocks);
      return prevString === newString ? prev : parsedBlocks;
    });
  }, []);

  useEffect(() => {
    // Only process the last assistant message for code blocks
    const lastAssistantMessage = [...messages]
      .reverse()
      .find(msg => msg.role === 'assistant');

    if (lastAssistantMessage) {
      handleCodeContextUpdate(lastAssistantMessage as MessageWithModel);
    }
  }, [messages, handleCodeContextUpdate]);

  const renderMessage = useCallback((message: MessageWithModel) => {
    // Skip rendering empty assistant messages only if they have no tool invocations
    if (
      message.role === 'assistant' &&
      !message.content &&
      (!message.toolInvocations || message.toolInvocations.length === 0)
    ) {
      return null;
    }

    if (message.id === 'edit-indicator') {
      return <EditIndicator key="edit-indicator" />;
    }

    // Prepare tool invocations for rendering
    let toolInvocationsToRender = message.toolInvocations;

    // If we have no content but have tool invocations, select the most complete one
    if (!message.content && message.toolInvocations && message.toolInvocations.length > 1) {
      const mostComplete = getMostCompleteToolInvocation(message.toolInvocations);
      toolInvocationsToRender = mostComplete ? [mostComplete] : undefined;
    }

    // Check if this is the first user message
    const isFirstUserMessage = messages.find(m => m.role === 'user')?.id === message.id;

    return (
      <ChatMessage
        key={message.id}
        message={{
          ...message,
          toolInvocations: toolInvocationsToRender
        }}
        chatId={chatId}
        onEditComplete={handleEditComplete}
        onModelChange={handleModelChange}
        isFirstUserMessage={isFirstUserMessage}
      />
    );
  }, [chatId, handleEditComplete, handleModelChange, messages, getMostCompleteToolInvocation]);

  const groupedMessages = messages.reduce((groups: MessageWithModel[][], message) => {
    if (message.role === 'user') {
      // Start a new group with user message
      groups.push([message as MessageWithModel]);
    } else if (groups.length && message.id !== 'edit-indicator') {
      // Add assistant message to last group
      groups[groups.length - 1].push(message as MessageWithModel);
    }
    return groups;
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Message container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto message-container"
      >
        <div className="flex flex-col w-full gap-4 px-4 md:px-8 py-4">
          {groupedMessages.map((group, i) => (
            <MessageGroup
              key={group[0].id}
              messages={group}
              renderMessage={renderMessage}
            />
          ))}
          {isThinking && (
            <div className="flex justify-center py-4 transform-gpu">
              <span className="text-sm text-muted-foreground loading-pulse">
                {messages[messages.length - 1]?.toolInvocations?.some(
                  tool => tool.state === 'partial-call' || tool.state === 'call'
                )
                  ? "Running tools..."
                  : "Loading chat..."}
              </span>
            </div>
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
            isLoading={isChatLoading}
            stop={stop}
            messages={messages}
            setMessages={setMessages}
            append={append}
            handleSubmit={handleSubmit}
            searchRepository={searchRepository}
            currentModel={currentModel}
            onModelChange={setCurrentModel}
            documentationMode={documentationMode}
            onDocumentationModeChange={setDocumentationMode}
          />
        </div>
      </div>
    </div>
  );
}
