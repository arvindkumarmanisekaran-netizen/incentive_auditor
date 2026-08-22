import { useEffect, useRef, useState, type ReactNode } from "react";

interface AnimateOnViewProps {
  children: ReactNode;
}

export function AnimateOnView({ children }: AnimateOnViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hasEnteredView, setHasEnteredView] = useState(false);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEnteredView(true);

          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.25,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="recharts-scroll-animation">
      {hasEnteredView ? children : null}
    </div>
  );
}
