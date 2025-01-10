"use client";

import type { Message } from "ai";
import { motion } from "framer-motion";

import { Markdown } from "./markdown";
import { PreviewAttachment } from "./preview-attachment";
import { cn } from "@/lib/utils";
import { ToolInvocationDisplay } from "./tool-invocation";
import { CodeContextContainer } from "./code-context-container";
import { CollapsibleCodeBlock } from "./collapsible-code-block";

export const PreviewMessage = ({
  message,
  isLoading,
}: {
  chatId: string;
  message: Message;
  isLoading: boolean;
}) => {
  // Helper function to extract image URLs from content array
  const getImagesFromContent = (content: any) => {
    if (!Array.isArray(content)) return [];
    return content
      .filter(item => item.type === 'image_url')
      .map(item => ({
        url: item.image_url.url,
        name: 'AI Response Image',
        contentType: 'image/jpeg' // Default type, adjust if needed
      }));
  };

  // Get images from both sources
  const attachmentImages = message.experimental_attachments || [];
  const contentImages = Array.isArray(message.content)
    ? getImagesFromContent(message.content)
    : [];

  // Combine all images
  const allImages = [...attachmentImages, ...contentImages];

  // Extract code blocks from the message content
  const getCodeBlocks = (content: string) => {
    const codeBlockRegex = /```[\s\S]*?```/g;
    return content.match(codeBlockRegex) || [];
  };

  const codeBlocks = typeof message.content === 'string' ? getCodeBlocks(message.content) : [];
  const hasCodeContext = codeBlocks.length > 0;

  // Separate code blocks from main content
  const contentWithoutCode = typeof message.content === 'string'
    ? message.content.replace(/```[\s\S]*?```/g, '')
    : message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={cn("message-connection group relative flex items-start md:gap-6 gap-4 pb-4", {
        "opacity-50": isLoading,
      })}
    >
      <div className="flex flex-col w-full">
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

        <div className="prose prose-neutral dark:prose-invert">
          <Markdown>{contentWithoutCode}</Markdown>
        </div>

        {/* Rest of the existing PreviewMessage content */}
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
    </motion.div>
  );
};
