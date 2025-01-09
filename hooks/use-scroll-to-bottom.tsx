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
  const scrollTimeout = useRef<number>();
  const isUserScrolling = useRef(false);
  const lastScrollTop = useRef(0);

  const scrollToBottom = (options: ScrollOptions = {}) => {
    const container = containerRef.current;
    if (!container) return;

    const { behavior = 'smooth', force = false } = options;

    if (force || !isUserScrolling.current) {
      const buffer = 200;
      container.scrollTo({
        top: container.scrollHeight + buffer,
        behavior
      });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollDebounceTimeout: NodeJS.Timeout;

    const isNearBottom = () => {
      const threshold = 100;
      const position = container.scrollHeight - container.scrollTop - container.clientHeight;
      return position <= threshold;
    };

    const observer = new MutationObserver(() => {
      if (scrollDebounceTimeout) {
        clearTimeout(scrollDebounceTimeout);
      }

      scrollDebounceTimeout = setTimeout(() => {
        if (!isUserScrolling.current && isNearBottom()) {
          scrollToBottom({ behavior: 'smooth' });
        }
      }, 50);
    });

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      isUserScrolling.current = currentScrollTop < lastScrollTop.current;
      lastScrollTop.current = currentScrollTop;

      container.classList.add('is-scrolling');
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = window.setTimeout(() => {
        container.classList.remove('is-scrolling');
      }, 1000);
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
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      if (scrollDebounceTimeout) {
        clearTimeout(scrollDebounceTimeout);
      }
    };
  }, []);

  return [containerRef, endRef, scrollToBottom];
}
