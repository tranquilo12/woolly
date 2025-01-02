import { useEffect, useRef, type RefObject, useCallback } from "react";

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const scrollTimeout = useRef<number>();
  const lastScrollPosition = useRef<number>(0);
  const isUserScrolling = useRef<boolean>(false);

  const smoothScrollToBottom = useCallback(() => {
    const container = containerRef.current;
    const end = endRef.current;
    if (!container || !end) return;

    const targetPosition = end.offsetTop;
    const startPosition = container.scrollTop;
    const distance = targetPosition - startPosition;
    const duration = 300; // ms
    let start: number | null = null;

    // Only scroll if we're near the bottom or if it's a new message
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (!isNearBottom && isUserScrolling.current) return;

    const animation = (currentTime: number) => {
      if (start === null) start = currentTime;
      const timeElapsed = currentTime - start;
      const progress = Math.min(timeElapsed / duration, 1);

      // Enhanced easing function for smoother scroll
      const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      container.scrollTop = startPosition + distance * ease(progress);
      lastScrollPosition.current = container.scrollTop;

      if (timeElapsed < duration) {
        scrollTimeout.current = requestAnimationFrame(animation);
      }
    };

    requestAnimationFrame(animation);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!container) return;
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      isUserScrolling.current = !isAtBottom;
    };

    const observer = new MutationObserver((mutations) => {
      // Only trigger scroll for content changes
      const hasContentChange = mutations.some(mutation =>
        mutation.type === 'characterData' ||
        mutation.addedNodes.length > 0
      );

      if (hasContentChange) {
        if (scrollTimeout.current) {
          cancelAnimationFrame(scrollTimeout.current);
        }
        smoothScrollToBottom();
      }
    });

    container.addEventListener('scroll', handleScroll, { passive: true });
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      observer.disconnect();
      if (scrollTimeout.current) {
        cancelAnimationFrame(scrollTimeout.current);
      }
    };
  }, [smoothScrollToBottom]);

  return [containerRef, endRef];
}
