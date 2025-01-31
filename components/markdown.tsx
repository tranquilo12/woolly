import Link from "next/link";
import React, { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";
import { CollapsibleCodeBlock } from "./collapsible-code-block";

type MarkdownProps = {
  children: string;
  isToolCallLoading?: boolean;
};

const NonMemoizedMarkdown = ({ children, isToolCallLoading }: MarkdownProps) => {
  if (isToolCallLoading) {
    return (
      <div className="p-2 text-gray-500 font-semibold">
        Loading tool call...
      </div>
    );
  }

  const components: Partial<Components> = {
    code: ({ node, className, children, ...props }) => {
      const value = String(children).replace(/\n$/, "");
      const language = className?.replace('language-', '') || 'text';

      if ('inline' in props) {
        return (
          <code className="rounded-md bg-muted/50 px-1.5 py-0.5 text-sm font-medium" {...props}>
            {children}
          </code>
        );
      }

      return (
        <CollapsibleCodeBlock
          language={language}
          value={value}
          initiallyExpanded={true}
        />
      );
    },
    p: ({ children }) => (
      <p className="mb-4 last:mb-0 leading-7">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="mb-4 list-disc pl-8 space-y-2">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-4 list-decimal pl-8 space-y-2">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="leading-7">{children}</li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    a: ({ href, children }) => (
      <Link
        href={href || ''}
        className="font-medium underline underline-offset-4 hover:text-primary"
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </Link>
    ),
    blockquote: ({ children }) => (
      <blockquote className="mt-6 border-l-2 pl-6 italic">{children}</blockquote>
    ),
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
      className="prose dark:prose-invert max-w-none break-words"
    >
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children &&
    prevProps.isToolCallLoading === nextProps.isToolCallLoading
);
