"use client";

import { type ChatRequestOptions, type CreateMessage, type Message } from "ai";
import { motion } from "framer-motion";
import type React from "react";
import {
  useRef,
  useEffect,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";

import { cn, sanitizeUIMessages } from "@/lib/utils";

import { ArrowUpIcon, StopIcon, MenuIcon } from "./icons";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useSidebar } from "./sidebar-provider";

const suggestedActions = [
  {
    title: "What is the weather",
    label: "in San Francisco?",
    action: "What is the weather in San Francisco?",
  },
  {
    title: "How is python useful",
    label: "for AI engineers?",
    action: "How is python useful for AI engineers?",
  },
];

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
}: {
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
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const { toggle, setIsOpen } = useSidebar();
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = width < 1024;

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

  const submitForm = useCallback(() => {
    const core_messages = messages.map((message) => {
      return {
        id: message.id,
        role: message.role,
        content: message.content,
        toolInvocations: message.toolInvocations,
      };
    });

    setMessages(core_messages);
    handleSubmit(undefined, {});
    setLocalStorageInput("");

    if (width && width > 1024) {
      textareaRef.current?.focus();
    }
  }, [handleSubmit, setLocalStorageInput, width, messages, setMessages]);

  useEffect(() => {
    if (!containerRef.current || !isMobile) return;

    // Get the sidebar element
    const sidebar = document.querySelector('[data-sidebar]');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          console.log("Intersection:", {
            isIntersecting: entry.isIntersecting,
            intersectionRatio: entry.intersectionRatio
          });

          // If there's significant overlap, close the sidebar
          if (entry.intersectionRatio > 0.1) {
            setIsOpen(false);
          }
        });
      },
      {
        threshold: [0, 0.1, 0.5, 1],
        root: sidebar || null,
      }
    );

    // Start observing
    observer.observe(containerRef.current);

    // Force a recalculation of intersections
    requestAnimationFrame(() => {
      if (containerRef.current) {
        // Trigger a reflow
        containerRef.current.style.display = 'none';
        containerRef.current.offsetHeight; // Force reflow
        containerRef.current.style.display = '';
      }
    });

    return () => observer.disconnect();
  }, [setIsOpen, isMobile]);

  return (
    <div ref={containerRef} className="relative z-20">
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background to-background/30 p-4 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              onClick={toggle}
            >
              <MenuIcon size={14} />
            </Button>

            <div className="relative w-full flex flex-col gap-4">
              {messages.length === 0 && (
                <div className="grid sm:grid-cols-2 gap-2 w-full">
                  {suggestedActions.map((suggestedAction, index) => (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ delay: 0.05 * index }}
                      key={`suggested-action-${suggestedAction.title}-${index}`}
                      className={index > 1 ? "hidden sm:block" : "block"}
                    >
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          append({
                            role: "user",
                            content: suggestedAction.action,
                          });
                        }}
                        className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
                      >
                        <span className="font-medium">{suggestedAction.title}</span>
                        <span className="text-muted-foreground">
                          {suggestedAction.label}
                        </span>
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}

              <Textarea
                ref={textareaRef}
                placeholder="Send a message..."
                value={input}
                onChange={handleInput}
                className={cn(
                  "min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-xl !text-base bg-muted",
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
                  className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600"
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
    </div>
  );
}
