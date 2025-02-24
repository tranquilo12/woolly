import Link from "next/link";
import React, { memo, useCallback, useMemo } from "react";
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

// Add efficient block parsing with better memoization
const useMarkdownBlocks = (content: string) => {
  return useMemo(() => {
    // Only split and process if content exists
    if (!content) return [];
    // More efficient splitting using regex to handle various newline formats
    return content
      .split(/\n{2,}/)
      .map(block => block.trim())
      .filter(Boolean);
  }, [content]);
};

// Add proper typing for code block props
type CodeBlockProps = {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
} & React.ComponentProps<'code'>;

// Extract markdown components to module scope
const MarkdownPre = memo(function MarkdownPre(props: React.ComponentProps<'pre'>) {
  return <pre {...props} />;
});
MarkdownPre.displayName = 'MarkdownPre';

const MarkdownCode = memo(function MarkdownCode({ node, inline, className, children, ...props }: CodeBlockProps) {
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
});
MarkdownCode.displayName = 'MarkdownCode';

const MarkdownParagraph = memo((props: React.ComponentProps<'p'>) => (
  <p className="mb-4 last:mb-0 leading-7" {...props} />
));
MarkdownParagraph.displayName = 'MarkdownParagraph';

const MarkdownList = memo((props: React.ComponentProps<'ul'>) => (
  <ul className="mb-4 list-disc pl-8 space-y-2" {...props} />
));
MarkdownList.displayName = 'MarkdownList';

const MarkdownOrderedList = memo((props: React.ComponentProps<'ol'>) => (
  <ol className="mb-4 list-decimal pl-8 space-y-2" {...props} />
));
MarkdownOrderedList.displayName = 'MarkdownOrderedList';

const MarkdownListItem = memo((props: React.ComponentProps<'li'>) => (
  <li className="leading-7" {...props} />
));
MarkdownListItem.displayName = 'MarkdownListItem';

const MarkdownStrong = memo((props: React.ComponentProps<'strong'>) => (
  <strong className="font-semibold" {...props} />
));
MarkdownStrong.displayName = 'MarkdownStrong';

const MarkdownLink = memo((props: React.ComponentProps<'a'>) => (
  <Link
    href={props.href || ''}
    className="font-medium underline underline-offset-4 hover:text-primary"
    target="_blank"
    rel="noreferrer"
    {...props}
  />
));
MarkdownLink.displayName = 'MarkdownLink';

const MarkdownBlockquote = memo((props: React.ComponentProps<'blockquote'>) => (
  <blockquote className="mt-6 border-l-2 pl-6 italic" {...props} />
));
MarkdownBlockquote.displayName = 'MarkdownBlockquote';

// Optimize component configuration
export const Markdown = memo(
  ({ children, isToolCallLoading }: MarkdownProps) => {
    const blocks = useMarkdownBlocks(children);

    // Now using pre-memoized components
    const components = useMemo(() => ({
      pre: MarkdownPre,
      code: MarkdownCode,
      p: MarkdownParagraph,
      ul: MarkdownList,
      ol: MarkdownOrderedList,
      li: MarkdownListItem,
      strong: MarkdownStrong,
      a: MarkdownLink,
      blockquote: MarkdownBlockquote,
    }), []); // Empty dependency array since components are static

    // Optimize key generation
    const getBlockKey = useCallback((block: string, index: number) => {
      return `md-block-${index}-${block.slice(0, 40).replace(/\s+/g, '-')}`;
    }, []);

    if (isToolCallLoading) {
      return <div className="p-2 text-gray-500 font-semibold">Loading tool call...</div>;
    }

    return (
      <>
        {blocks.map((block, index) => (
          <MemoizedMarkdownBlock
            key={getBlockKey(block, index)}
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
