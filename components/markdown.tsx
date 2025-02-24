import Link from "next/link";
import React, { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CollapsibleCodeBlock } from "./collapsible-code-block";

type MarkdownProps = {
  children: string;
  isToolCallLoading?: boolean;
};

// Memoize individual markdown blocks
const MemoizedMarkdownBlock = memo(({ content, components }: {
  content: string;
  components: Partial<Components>;
}) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={components}
    className="prose dark:prose-invert max-w-none break-words"
  >
    {content}
  </ReactMarkdown>
));

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

// Cache parsed content blocks
const useMarkdownBlocks = (content: string) => {
  return useMemo(() => {
    // Split content into blocks at double newlines
    return content.split('\n\n').filter(block => block.trim());
  }, [content]);
};

export const Markdown = memo(
  ({ children, isToolCallLoading }: MarkdownProps) => {
    const blocks = useMarkdownBlocks(children);
    // Memoize components configuration
    const components = useMemo(() => ({
      pre: (props: React.ComponentProps<'pre'>) => <pre {...props} />,
      code: ({ node, inline, className, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
          <CollapsibleCodeBlock
            language={match[1]}
            value={String(children).replace(/\n$/, '')}
            initiallyExpanded={true}
          />
        ) : (
          <code className={className} {...props}>{children}</code>
        );
      },
      p: (props: React.ComponentProps<'p'>) => <p className="mb-4 last:mb-0 leading-7" {...props} />,
      ul: (props: React.ComponentProps<'ul'>) => <ul className="mb-4 list-disc pl-8 space-y-2" {...props} />,
      ol: (props: React.ComponentProps<'ol'>) => <ol className="mb-4 list-decimal pl-8 space-y-2" {...props} />,
      li: (props: React.ComponentProps<'li'>) => <li className="leading-7" {...props} />,
      strong: (props: React.ComponentProps<'strong'>) => <strong className="font-semibold" {...props} />,
      a: (props: React.ComponentProps<'a'>) => (
        <Link
          href={props.href || ''}
          className="font-medium underline underline-offset-4 hover:text-primary"
          target="_blank"
          rel="noreferrer"
          {...props}
        />
      ),
      blockquote: (props: React.ComponentProps<'blockquote'>) => (
        <blockquote className="mt-6 border-l-2 pl-6 italic" {...props} />
      ),
    }), []);
    if (isToolCallLoading) {
      return <div className="p-2 text-gray-500 font-semibold">Loading tool call...</div>;
    }

    return (
      <>
        {blocks.map((block, index) => (
          <MemoizedMarkdownBlock
            key={`${block.slice(0, 40)}-${index}`}
            content={block}
            components={components}
          />
        ))}
      </>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.isToolCallLoading === nextProps.isToolCallLoading
);

Markdown.displayName = 'Markdown';
