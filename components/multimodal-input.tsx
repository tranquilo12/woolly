"use client";

import { type ChatRequestOptions, type CreateMessage, type Message, type Attachment } from "ai";
import type React from "react";
import {
  useRef,
  useEffect,
  useCallback,
  type Dispatch,
  type SetStateAction,
  useState,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";

import { cn, sanitizeUIMessages } from "@/lib/utils";

import { ArrowUpIcon, StopIcon, MenuIcon, AttachmentIcon } from "./icons";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useSidebar } from "./sidebar-provider";
import { PreviewAttachment } from "./preview-attachment";

interface MultimodalInputProps {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  className?: string;
}

export function MultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
}: MultimodalInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const { toggle, setIsOpen, isPinned, isOpen } = useSidebar();
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = width < 1024;
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    "",
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      name: file.name,
      url: URL.createObjectURL(file),
      contentType: file.type
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const submitForm = useCallback(async () => {
    try {
      const messageData = {
        role: 'user',
        content: input,
        id: crypto.randomUUID(),
        attachments
      };

      await handleSubmit(undefined, {
        body: {
          chatId,
          messages: [...messages, messageData].map(msg => ({
            role: msg.role,
            content: msg.content,
            id: msg.id,
          }))
        }
      });

      setInput('');
      setLocalStorageInput('');
      setAttachments([]);
    } catch (error) {
      console.error('Error submitting message:', error);
      toast.error('Failed to send message');
    }
  }, [input, chatId, messages, handleSubmit, setInput, setLocalStorageInput, attachments, setMessages]);

  return (
    <form onSubmit={(e) => handleSubmit(e)}>
      <div ref={containerRef} className="relative">
        <div className="p-4">
          <div className="mx-auto max-w-3xl relative flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 bg-background hover:bg-accent/50 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isOpen && !isPinned) {
                  setIsOpen(false);
                } else if (!isPinned) {
                  toggle();
                }
              }}
            >
              <MenuIcon size={16} />
            </Button>

            <div className="flex-1">
              {attachments.length > 0 && (
                <div className="flex flex-row gap-2 mb-2">
                  {attachments.map((attachment) => (
                    <PreviewAttachment
                      key={attachment.url}
                      attachment={attachment}
                    />
                  ))}
                </div>
              )}

              <div className="relative">
                <input
                  title="file-input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 z-10 hover:bg-background/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <AttachmentIcon />
                </Button>

                <Textarea
                  ref={textareaRef}
                  placeholder="Send a message..."
                  value={input}
                  onChange={handleInput}
                  className={cn(
                    "min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-xl !text-base bg-muted pr-12",
                    className,
                  )}
                  rows={3}
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (isLoading) {
                        toast.error("Please wait for the model to finish its response!");
                      } else {
                        submitForm();
                      }
                    }
                  }}
                />
              </div>

              {isLoading ? (
                <Button
                  className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600"
                  onClick={(event) => {
                    event.preventDefault();
                    stop();
                    setMessages((messages) => sanitizeUIMessages(messages));
                  }}
                >
                  <StopIcon size={14} />
                </Button>
              ) : (
                <Button
                  className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 hover:bg-accent/50 transition-colors"
                  onClick={(event) => {
                    event.preventDefault();
                    submitForm();
                  }}
                  disabled={input.length === 0}
                >
                  <ArrowUpIcon size={14} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
