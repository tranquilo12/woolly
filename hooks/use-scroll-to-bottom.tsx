import { useEffect, useRef, type RefObject } from "react";

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const scrollTimeout = useRef<number>();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new MutationObserver(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Handle scrollbar visibility
    const handleScroll = () => {
      container.classList.add('is-scrolling');
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = window.setTimeout(() => {
        container.classList.remove('is-scrolling');
      }, 1000);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  return [containerRef, endRef];
}
