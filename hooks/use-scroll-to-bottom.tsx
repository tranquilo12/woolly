import { useEffect, useRef, type RefObject } from "react";

interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  force?: boolean;
}

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
  (options?: ScrollOptions) => void
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const isUserScrolling = useRef(false);
  const lastScrollTop = useRef(0);
  const scrollFrameId = useRef<number | null>(null);

  const scrollToBottom = (options: ScrollOptions = {}) => {
    const container = containerRef.current;
    if (!container) return;

    const { behavior = 'smooth', force = false } = options;

    // Cancel any pending scroll frame
    if (scrollFrameId.current) {
      cancelAnimationFrame(scrollFrameId.current);
    }

    // Schedule scroll in next frame
    scrollFrameId.current = requestAnimationFrame(() => {
      if (force || !isUserScrolling.current) {
        endRef.current?.scrollIntoView({ behavior });
      }
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isNearBottom = () => {
      const threshold = 100;
      const position = container.scrollHeight - container.scrollTop - container.clientHeight;
      return position <= threshold;
    };

    let scrollTimeout: number;
    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      isUserScrolling.current = currentScrollTop < lastScrollTop.current;
      lastScrollTop.current = currentScrollTop;

      // Batch UI updates
      if (scrollTimeout) {
        cancelAnimationFrame(scrollTimeout);
      }

      scrollTimeout = requestAnimationFrame(() => {
        container.classList.toggle('is-scrolling', true);
        setTimeout(() => {
          container.classList.toggle('is-scrolling', false);
        }, 1000);
      });
    };

    const observer = new MutationObserver(() => {
      if (!isUserScrolling.current && isNearBottom()) {
        scrollToBottom();
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', handleScroll);
      if (scrollFrameId.current) {
        cancelAnimationFrame(scrollFrameId.current);
      }
      if (scrollTimeout) {
        cancelAnimationFrame(scrollTimeout);
      }
    };
  }, [scrollToBottom]);

  return [containerRef as RefObject<T>, endRef as RefObject<T>, scrollToBottom];
}
