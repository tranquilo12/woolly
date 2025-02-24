import Link from "next/link";
import React, { memo, useCallback, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CollapsibleCodeBlock } from "./collapsible-code-block";

type MarkdownProps = {
  children: string;
  isToolCallLoading?: boolean;
};

// Add block caching mechanism
const blockCache = new Map<string, string[]>();

// Improve block parsing efficiency
const useMarkdownBlocks = (content: string) => {
  return useMemo(() => {
    // Check cache first
    const cacheKey = content;
    if (blockCache.has(cacheKey)) {
      return blockCache.get(cacheKey)!;
    }

    // Only split and process if content exists
    if (!content) return [];

    // More efficient splitting using positive lookahead
    const blocks = content
      .split(/(?=\n{2,})|(?=#{1,6}\s)|(?=```)/g)
      .map(block => block.trim())
      .filter(Boolean);

    // Cache the result
    blockCache.set(cacheKey, blocks);

    // Prevent cache from growing too large
    if (blockCache.size > 1000) {
      const firstKey = blockCache.keys().next().value;
      if (firstKey) {
        blockCache.delete(firstKey as string);
      }
    }

    return blocks;
  }, [content]);
};

// Add block type detection for better rendering
const getBlockType = (block: string): 'code' | 'heading' | 'paragraph' => {
  if (block.startsWith('```')) return 'code';
  if (/^#{1,6}\s/.test(block)) return 'heading';
  return 'paragraph';
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

// Update MemoizedMarkdownBlock to use block type information
const MemoizedMarkdownBlock = memo(({ content, components, blockType }: {
  content: string;
  components: Partial<Components>;
  blockType: 'code' | 'heading' | 'paragraph';
}) => {
  // Optimize rendering based on block type
  const className = useMemo(() => {
    const baseClass = "prose dark:prose-invert max-w-none break-words";
    switch (blockType) {
      case 'code':
        return `${baseClass} my-4`;
      case 'heading':
        return `${baseClass} font-semibold`;
      default:
        return baseClass;
    }
  }, [blockType]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
      className={className}
    >
      {content}
    </ReactMarkdown>
  );
});

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

// Update the main Markdown component to use the new block type system
export const Markdown = memo(
  ({ children, isToolCallLoading }: MarkdownProps) => {
    const blocks = useMarkdownBlocks(children);

    // Components configuration remains the same
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
    }), []);

    const getBlockKey = useCallback((block: string, index: number) => {
      const type = getBlockType(block);
      return `md-block-${type}-${index}-${block.slice(0, 40).replace(/\s+/g, '-')}`;
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
            blockType={getBlockType(block)}
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
