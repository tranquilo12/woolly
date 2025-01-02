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
    const end = endRef.current;

    if (container && end) {
      const smoothScrollToBottom = () => {
        const targetPosition = end.offsetTop;
        const startPosition = container.scrollTop;
        const distance = targetPosition - startPosition;
        const duration = 300; // ms
        let start: number | null = null;

        const animation = (currentTime: number) => {
          if (start === null) start = currentTime;
          const timeElapsed = currentTime - start;
          const progress = Math.min(timeElapsed / duration, 1);

          // Easing function for smooth deceleration
          const ease = (t: number) => t * (2 - t);

          container.scrollTop = startPosition + distance * ease(progress);

          if (timeElapsed < duration) {
            requestAnimationFrame(animation);
          }
        };

        requestAnimationFrame(animation);
      };

      const observer = new MutationObserver(() => {
        // Clear any existing scroll timeout
        if (scrollTimeout.current) {
          window.cancelAnimationFrame(scrollTimeout.current);
        }

        // Schedule new scroll
        scrollTimeout.current = requestAnimationFrame(smoothScrollToBottom);
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      return () => {
        observer.disconnect();
        if (scrollTimeout.current) {
          window.cancelAnimationFrame(scrollTimeout.current);
        }
      };
    }
  }, []);

  return [containerRef, endRef];
}
