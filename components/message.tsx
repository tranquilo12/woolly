"use client";

import type { Message } from "ai";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";

import { SparklesIcon, UserIcon } from "./icons";
import { Markdown } from "./markdown";
import { PreviewAttachment } from "./preview-attachment";
import { cn } from "@/lib/utils";
import { ToolInvocationDisplay } from "./tool-invocation";

export const PreviewMessage = ({
  message,
  isLoading,
}: {
  chatId: string;
  message: Message;
  isLoading: boolean;
}) => {
  const { data: session } = useSession();

  // Helper function to extract image URLs from content array
  const getImagesFromContent = (content: any) => {
    if (!Array.isArray(content)) return [];
    return content
      .filter(item => item.type === 'image_url')
      .map(item => ({
        url: item.image_url.url,
        name: 'AI Response Image',
        contentType: 'image/jpeg'
      }));
  };

  const attachmentImages = message.experimental_attachments || [];
  const contentImages = Array.isArray(message.content)
    ? getImagesFromContent(message.content)
    : [];
  const allImages = [...attachmentImages, ...contentImages];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={cn("group relative flex items-start md:gap-6 gap-4 pb-4", {
        "opacity-50": isLoading,
      })}
    >
      <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
        {message.role === 'assistant' ? (
          <SparklesIcon size={14} />
        ) : (
          session?.user?.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || 'User'}
              className="rounded-full size-8"
            />
          ) : (
            <UserIcon />
          )
        )}
      </div>

      <div className="flex flex-col w-full">
        <div className="text-sm text-muted-foreground mb-2">
          {message.role === 'assistant' ? 'AI Assistant' : session?.user?.name || 'You'}
        </div>

        <div className="prose prose-neutral dark:prose-invert">
          {/* Text content */}
          <Markdown>{message.content}</Markdown>

          {/* Images */}
          {allImages.length > 0 && (
            <div className="flex flex-row gap-2 mt-4">
              {allImages.map((attachment, index) => (
                <PreviewAttachment
                  key={`${attachment.url}-${index}`}
                  attachment={attachment}
                />
              ))}
            </div>
          )}

          {/* Tool invocations */}
          {message.toolInvocations && message.toolInvocations.length > 0 && (
            <div className="mt-4">
              {message.toolInvocations.map((toolInvocation) => (
                <ToolInvocationDisplay
                  key={toolInvocation.toolCallId}
                  toolInvocation={toolInvocation}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cn(
          "flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl",
          {
            "group-data-[role=user]/message:bg-muted": true,
          },
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
