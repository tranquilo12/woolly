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
import { useLocalStorage } from "usehooks-ts";
import { AnimatePresence } from "framer-motion";

import { cn, getCaretCoordinates, sanitizeUIMessages } from "@/lib/utils";

import { ArrowUpIcon, StopIcon, MenuIcon, AttachmentIcon } from "./icons";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useSidebar } from "./sidebar-provider";
import { PreviewAttachment } from "./preview-attachment";
import { AVAILABLE_REPOSITORIES, AvailableRepository } from "@/lib/constants";
import { parseRepositoryCommand } from "@/lib/commands";
import { RepositorySearchResult, SearchRepositoryRequest } from "@/hooks/use-repository-status";
import { RepositoryMentionMenu } from "./repository-mention-menu";

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
  searchRepository: (repoName: AvailableRepository, query: SearchRepositoryRequest) => Promise<{ results: RepositorySearchResult[] }>;
}

const isValidMentionContext = (text: string): boolean => {
  // Find the last @ symbol
  const lastAtIndex = text.lastIndexOf('@');
  if (lastAtIndex === -1) return false;

  // Check if there's a space between the @ and the cursor
  const textAfterAt = text.slice(lastAtIndex + 1);
  return !textAfterAt.includes(' ');
};

interface RepositorySearchTemplate {
  prefix: string;
  resultFormat: string;
  separator: string;
  suffix: string;
  emptyResult: string;
}

const DEFAULT_REPOSITORY_TEMPLATE: RepositorySearchTemplate = {
  prefix: "Based on the repository {repoName}, here's what I found:\n\n",
  resultFormat: "```{language}\n# File: {filePath}\n{content}\n```",
  separator: "\n\n",
  suffix: "\n\nQuery: {query}",
  emptyResult: "No relevant code found in repository {repoName} for query: {query}"
};

const formatRepositoryResponse = (
  repoName: string,
  results: RepositorySearchResult[],
  query: string,
  template: RepositorySearchTemplate = DEFAULT_REPOSITORY_TEMPLATE
): string => {
  if (results.length === 0) {
    return `I couldn't find any relevant code in the repository "${repoName}" for your query: "${query}".
Can you please respond that the repository is not indexed?`;
  }

  const formattedResults = results.map(r =>
    template.resultFormat
      .replace("{filePath}", r.file_path)
      .replace("{content}", r.content)
      .replace("{language}", r.file_path.split('.').pop() || 'text')
  );

  return template.prefix.replace("{repoName}", repoName) +
    formattedResults.join(template.separator) +
    template.suffix.replace("{query}", query);
};

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
  searchRepository,
}: MultimodalInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toggle, setIsOpen, isPinned, isOpen } = useSidebar();
  const containerRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({
    top: 0,
    left: 0,
    placement: 'below' as 'below' | 'above'
  });
  const [mentionSearchTerm, setMentionSearchTerm] = useState("");
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);

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
    const newValue = event.target.value;
    setInput(newValue);

    // Check if we should hide the menu
    const { selectionStart } = event.target;
    const textBeforeCursor = newValue.slice(0, selectionStart);
    if (!isValidMentionContext(textBeforeCursor)) {
      setShowMentionMenu(false);
    }

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


  const handleSubmitWithCommands = useCallback(async (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions,
  ) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    if (!input) return;

    console.log('🎯 Processing input:', input);
    const command = parseRepositoryCommand(input);
    console.log('🔄 Processed command:', command);

    try {
      if (command) {
        console.log('🔎 Searching repository:', { repoName: command.repository, query: command.query });
        const searchResponse = await searchRepository(command.repository, {
          query: command.query,
          limit: 10,
          threshold: 0.7
        });
        console.log('📊 Search results:', searchResponse);

        const contextMessage = formatRepositoryResponse(
          command.repository,
          searchResponse.results || [], // Extract just the results array
          command.query
        );
        console.log('📝 Formatted response:', contextMessage);

        const messageBody = {
          messages: [
            ...messages.map(m => ({
              role: m.role,
              content: m.content,
              id: m.id
            })),
            {
              role: 'user',
              content: contextMessage,
            }
          ],
          model: "gpt-4o"
        };

        await append(
          {
            role: 'user',
            content: contextMessage,
          },
          {
            body: messageBody
          }
        );
      } else {
        // Handle regular message without repository context
        const messageBody = {
          messages: [
            ...messages.map(m => ({
              role: m.role,
              content: m.content,
              id: m.id
            })),
            {
              role: 'user',
              content: input,
            }
          ],
          model: "gpt-4o"
        };

        await append(
          {
            role: 'user',
            content: input,
          },
          {
            body: messageBody
          }
        );
      }

      setInput('');
    } catch (error) {
      console.error('Error in handleSubmitWithCommands:', error);
      toast.error(
        `Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, [input, searchRepository, messages, append, setInput]);

  const submitForm = useCallback(async () => {
    if (!input) return;
    await handleSubmitWithCommands();
  }, [input, handleSubmitWithCommands]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu) {
      if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
        handleMenuNavigation(event);
        return;
      }
    }

    if (event.key === "@") {
      const textarea = event.currentTarget;
      const { selectionStart } = textarea;
      const textareaRect = textarea.getBoundingClientRect();
      const { top: caretTop, left: caretLeft } = getCaretCoordinates(textarea, selectionStart);

      const menuHeight = 300;
      const absoluteTop = textareaRect.top + window.scrollY + caretTop;
      const absoluteLeft = textareaRect.left + caretLeft;

      const spaceAbove = absoluteTop;
      const spaceBelow = window.innerHeight - absoluteTop;

      let placement: 'above' | 'below' = 'below';
      let menuTop = absoluteTop + 20;

      if (spaceBelow < menuHeight && spaceAbove >= menuHeight) {
        placement = 'above';
        menuTop = absoluteTop - menuHeight - 8;
      }

      setMentionPosition({
        top: menuTop,
        left: absoluteLeft,
        placement
      });

      setShowMentionMenu(true);
      setMentionSearchTerm("");
      setSelectedMenuIndex(0);
    } else if (event.key === "Escape" && showMentionMenu) {
      event.preventDefault();
      setShowMentionMenu(false);
    } else if (event.key === "Enter" && !event.shiftKey && !showMentionMenu) {
      event.preventDefault();
      if (isLoading) {
        toast.error("Please wait for the model to finish its response!");
      } else {
        submitForm();
      }
    }
  };

  const handleRepositorySelect = (repo: AvailableRepository) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = input.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const textBeforeAt = textBeforeCursor.slice(0, lastAtIndex);
    const textAfterCursor = input.slice(cursorPosition);

    setInput(`${textBeforeAt}@${repo}${textAfterCursor}`);
    setShowMentionMenu(false);

    // Restore focus and move cursor after the repository name
    textarea.focus();
    const newCursorPosition = textBeforeAt.length + repo.length + 1; // +1 for @
    textarea.setSelectionRange(newCursorPosition, newCursorPosition);
  };

  const handleMenuNavigation = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const filteredRepos = AVAILABLE_REPOSITORIES.filter(repo =>
      repo.toLowerCase().includes(mentionSearchTerm.toLowerCase())
    );

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedMenuIndex(prev =>
        prev > 0 ? prev - 1 : filteredRepos.length - 1
      );
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedMenuIndex(prev =>
        prev < filteredRepos.length - 1 ? prev + 1 : 0
      );
    } else if (event.key === "Enter" && showMentionMenu) {
      event.preventDefault();
      if (filteredRepos[selectedMenuIndex]) {
        handleRepositorySelect(filteredRepos[selectedMenuIndex]);
      }
    }
  };

  return (
    <form onSubmit={(e) => handleSubmitWithCommands(e)}>
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
                    <PreviewAttachment key={attachment.url} attachment={attachment} />
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
                  onKeyDown={handleKeyDown}
                />
                <AnimatePresence>
                  {showMentionMenu && (
                    <RepositoryMentionMenu
                      isOpen={showMentionMenu}
                      searchTerm={mentionSearchTerm}
                      onSelect={handleRepositorySelect}
                      position={mentionPosition}
                      selectedIndex={selectedMenuIndex}
                    />
                  )}
                </AnimatePresence>
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
                    handleSubmitWithCommands();
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
