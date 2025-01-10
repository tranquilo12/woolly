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

  const scrollToBottom = (options: ScrollOptions = {}) => {
    const container = containerRef.current;
    if (!container) return;

    const { behavior = 'smooth', force = false } = options;

    if (force || !isUserScrolling.current) {
      endRef.current?.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isNearBottom = () => {
      const threshold = 100;
      const position = container.scrollHeight - container.scrollTop - container.clientHeight;
      return position <= threshold;
    };

    const observer = new MutationObserver(() => {
      if (!isUserScrolling.current && isNearBottom()) {
        scrollToBottom();
      }
    });

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      isUserScrolling.current = currentScrollTop < lastScrollTop.current;
      lastScrollTop.current = currentScrollTop;

      container.classList.toggle('is-scrolling', true);
      const timeoutId = setTimeout(() => {
        container.classList.toggle('is-scrolling', false);
      }, 1000);

      return () => clearTimeout(timeoutId);
    };

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return [containerRef, endRef, scrollToBottom];
}
