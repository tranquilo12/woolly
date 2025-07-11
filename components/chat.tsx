"use client";

import { useChat } from "ai/react";
import { ChatRequestOptions, CreateMessage, LanguageModelUsage, Message } from "ai";
import { MultimodalInput } from "./multimodal-input";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useState, useEffect, memo, useCallback, SetStateAction, Dispatch } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Markdown } from "./markdown";
import { EditMessageInput } from "./edit-message-input";
import { EditIndicator } from "./edit-indicator";
import { useChatTitle } from "./chat-title-context";
import { useRepositoryStatus } from "@/hooks/use-repository-status";
import { MessageGroup } from "./message-group";
import { Button } from "@/components/ui/button";
import { PencilIcon, TrashIcon } from "lucide-react";
import { ExtendedToolCall } from "@/types/tool-calls";
import { useAgentPanel } from "./agent-panel/agent-provider";
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Skeleton } from './ui/skeleton';

interface ChatProps {
  chatId?: string;
}

interface ChatMessageProps {
  message: MessageWithModel;
  chatId: string | undefined;
  onEditComplete: (message: MessageWithModel) => void;
  onModelChange: (model: string, messageId: string) => void;
  isFirstUserMessage?: boolean;
  isOrphaned?: boolean;
  onDelete?: () => void;
}

export interface MessageWithModel extends Message {
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  data?: {
    dbId?: string;
  };
  tool_invocations?: ExtendedToolCall[];
  messageType?: string;
  agentId?: string;
  pipeline_id?: string;
}

export function toMessage(messageWithModel: MessageWithModel): Message {
  const { model, tool_invocations, toolInvocations, ...messageProps } = messageWithModel;
  return {
    ...messageProps,
    toolInvocations: tool_invocations || toolInvocations
  };
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
    toolInvocations: (message.toolInvocations) as ExtendedToolCall[],
    data: { dbId: message.id },
    messageType: (message as MessageWithModel).messageType
  };
}

// Dynamically import heavy components
const ToolInvocationDisplay = dynamic(
  () => import('./tool-invocation').then(mod => mod.ToolInvocationDisplay),
  {
    loading: () => <Skeleton className="w-full h-4" />,
    ssr: true // Keep SSR for this as it's part of the main content
  }
);

const TokenCount = dynamic(
  () => import('./token-count').then(mod => mod.TokenCount),
  {
    loading: () => null, // Token count can appear with a delay
    ssr: false
  }
);

// Memoized Message component to prevent unnecessary re-renders
const ChatMessage = memo(({ message, chatId, onEditComplete, onModelChange, isFirstUserMessage, isOrphaned, onDelete }: ChatMessageProps) => {
  const [isEditing, setIsEditing] = useState(false);

  const messageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  };

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
          <div className="prose dark:prose-invert">
            <Markdown>{message.content}</Markdown>
          </div>

          <Suspense fallback={<Skeleton className="w-full h-4" />}>
            {message.toolInvocations?.map((tool, index) => (
              <ToolInvocationDisplay
                key={`${message.id}-${tool.toolCallId || 'tool'}-${index}`}
                toolInvocation={{
                  id: tool.toolCallId,
                  toolCallId: tool.toolCallId,
                  toolName: tool.toolName,
                  args: tool.args,
                  state: tool.state,
                  result: 'result' in tool ? tool.result : undefined
                }}
              />
            ))}
          </Suspense>

          <Suspense fallback={null}>
            <TokenCount
              prompt_tokens={message.prompt_tokens}
              completion_tokens={message.completion_tokens}
              total_tokens={message.total_tokens}
            />
          </Suspense>
        </motion.div>

        {message.role === "user" && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {!isFirstUserMessage && (
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
            )}
            {isOrphaned && onDelete && (
              <motion.div
                className="transition-opacity"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-0 hover:bg-destructive/10 transition-colors"
                  onClick={onDelete}
                >
                  <TrashIcon className="h-4 w-4 text-destructive" />
                </Button>
              </motion.div>
            )}
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
  const [isThinking, setIsThinking] = useState(false);
  const [containerRef, endRef, scrollToBottom] = useScrollToBottom<HTMLDivElement>();
  const { setTitle } = useChatTitle();
  const [currentModel, setCurrentModel] = useState("gpt-4o");
  const { isOpen: isAgentOpen } = useAgentPanel();

  // Memoize repository status hooks
  const {
    searchRepository,
    getRepositoryStats,
    getRepositoryMap,
    getRepositorySummary
  } = useRepositoryStatus();

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
          // Filter out any messages that might have agent_id (shouldn't happen, but just in case)
          const nonAgentMessages = messages.filter((msg: MessageWithModel) => !msg.agentId && !msg.messageType);
          setInitialMessages(nonAgentMessages);
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
    input,
    handleInputChange,
    handleSubmit,
    append,
    stop,
    setInput,
    setMessages,
    isLoading: isChatLoading,
  } = useChat({
    experimental_throttle: 50,
    api: chatId ? `/api/chat/${chatId}` : "/api/chat",
    id: chatId,
    initialMessages: initialMessages.map(toMessage),
    body: {
      id: chatId
    },
    onToolCall: async (tool) => {
      // console.log('onToolCall', tool);

      setMessages(prevMessages => {
        const lastMessage = prevMessages[prevMessages.length - 1];
        if (!lastMessage) return prevMessages;

        const updatedToolInvocations = lastMessage.toolInvocations || [];
        const existingToolIndex = updatedToolInvocations.findIndex(t => t.toolCallId === tool.toolCall.toolCallId);

        if (existingToolIndex >= 0) {
          updatedToolInvocations[existingToolIndex] = {
            ...updatedToolInvocations[existingToolIndex],
            toolCallId: tool.toolCall.toolCallId,
            toolName: tool.toolCall.toolName,
            args: tool.toolCall.args,
          };
        } else {
          updatedToolInvocations.push({
            toolCallId: tool.toolCall.toolCallId,
            toolName: tool.toolCall.toolName,
            args: tool.toolCall.args,
            // @ts-ignore Property 'state' does not exist on type 'ToolCall<string, unknown>'
            state: tool.toolCall.state || 'partial-call'
          });
        }

        return prevMessages.map((msg, i) =>
          i === prevMessages.length - 1
            ? { ...msg, toolInvocations: updatedToolInvocations }
            : msg
        );
      });
    },
    onResponse: (response) => {
      if (!response.ok) {
        console.error('Stream response error:', response.status);
        toast.error('Error in chat response');
        return;
      }
    },
    onFinish: async (message, options) => {
      try {
        const messageWithModel = {
          ...message,
          model: currentModel,
          prompt_tokens: options.usage?.promptTokens,
          completion_tokens: options.usage?.completionTokens,
          total_tokens: options.usage?.totalTokens,
          toolInvocations: message.toolInvocations?.map(tool => ({
            ...tool,
            state: tool.state || 'result'
          }))
        } as MessageWithModel;

        // Remove any agent-related fields
        delete messageWithModel.agentId;
        delete messageWithModel.messageType;

        setMessages(prevMessages =>
          prevMessages.map(m =>
            m.id === messageWithModel.id ? messageWithModel : m
          )
        );

        setIsRestreaming(false);
        setIsThinking(false);
      } catch (error) {
        console.error('Failed to update message state:', error);
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
      toast.error('An error occurred during the chat');
      setIsThinking(false);
    }
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
  }, [isChatLoading, messages]);

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

      await append(
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

  const onDelete = useCallback(async (messageId: string) => {
    if (!chatId || !messageId) return;
    try {
      await fetch(`/api/chat/${chatId}/messages/${messageId}`, {
        method: 'DELETE',
      });
      // Update local messages state after successful deletion
      setMessages(prevMessages =>
        prevMessages.filter(m => m.id !== messageId)
      );
      toast.success('Message deleted');
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  }, [chatId, setMessages]);

  const renderMessage = useCallback((message: MessageWithModel, isOrphaned?: boolean) => {
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
    const toolInvocationsToRender = message.toolInvocations;

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
        isOrphaned={isOrphaned}
        onDelete={() => onDelete(message.id)}
      />
    );
  }, [chatId, handleEditComplete, handleModelChange, messages, onDelete]);

  // Add this before the groupedMessages reduction
  // console.log('Processing messages:', messages.map(m => ({
  //   id: m.id,
  //   role: m.role,
  //   messageType: (m as MessageWithModel).messageType,
  //   hasToolInvocations: !!(m as MessageWithModel).toolInvocations?.length
  // })));

  // Filter out any agent messages from the grouped messages
  const groupedMessages = messages.reduce((groups: MessageWithModel[][], message) => {
    const typedMessage = message as MessageWithModel;

    // Only filter out mermaid-specific messages, allow documentation messages
    if (typedMessage.messageType === 'mermaid') {
      return groups;
    }

    // Start a new group with user message
    if (message.role === 'user') {
      groups.push([message as MessageWithModel]);
    } else if (groups.length && message.id !== 'edit-indicator' && message.role === 'assistant') {
      // Add assistant message to last group
      groups[groups.length - 1].push(message as MessageWithModel);
    }

    return groups;
  }, []);

  const copyConversationToClipboard = useCallback(async () => {
    try {
      const conversationJson = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      await navigator.clipboard.writeText(JSON.stringify(conversationJson, null, 2));
      toast.success('Conversation copied to clipboard');
    } catch (error) {
      console.error('Failed to copy conversation:', error);
      toast.error('Failed to copy conversation');
    }
  }, [messages]);

  return (
    <div className="h-[calc(100vh-var(--navbar-height))] flex flex-col">
      {/* Message container - will grow to fill available space */}
      <div className="flex-1 min-h-0">
        <div
          ref={containerRef}
          className="h-full overflow-y-auto message-container"
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
      </div>

      {/* Input container - will stay at bottom */}
      <div className="flex-shrink-0 w-full bg-background border-t">
        <MultimodalInput
          chatId={chatId || ''}
          input={input}
          setInput={setInput}
          isLoading={isChatLoading}
          stop={stop}
          messages={messages}
          setMessages={setMessages as Dispatch<SetStateAction<Message[]>>}
          append={append}
          handleSubmit={handleSubmit}
          searchRepository={searchRepository}
          currentModel={currentModel}
          onModelChange={setCurrentModel}
          onCopyConversation={copyConversationToClipboard}
        />
      </div>
    </div>
  );
}
