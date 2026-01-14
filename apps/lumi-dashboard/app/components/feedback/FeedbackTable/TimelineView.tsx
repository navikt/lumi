import { useEffect, useRef, useState } from "react";
import type { Answer } from "~/types/api";
import { RenderAnswer } from "./AnswerRenderer";

// Timeline component that connects answer items with lines
export function TimelineView({
  answers,
  styles,
}: { answers: Answer[]; styles: Record<string, string> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ top: number; height: number }[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const calculateLines = () => {
      // Logic relies on consistent elements, using a static JS class for selection
      const circles = container.querySelectorAll(".js-answer-number");
      const newLines: { top: number; height: number }[] = [];

      circles.forEach((circle, index) => {
        if (index < circles.length - 1) {
          const currentRect = circle.getBoundingClientRect();
          const nextCircle = circles[index + 1];
          const nextRect = nextCircle.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          // Line starts at bottom of current circle, ends at top of next circle
          const top = currentRect.bottom - containerRect.top;
          const height = nextRect.top - currentRect.bottom;

          newLines.push({ top, height });
        }
      });

      setLines(newLines);
    };

    // Calculate on mount and after a short delay (for animations)
    calculateLines();
    const timeoutId = setTimeout(calculateLines, 100);

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(calculateLines);
    resizeObserver.observe(container);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={styles.answersList} ref={containerRef}>
      {/* SVG layer for connector lines */}
      <svg className={styles.connectorLines} aria-hidden="true">
        {lines.map((line) => (
          <line
            key={line.top}
            x1="15"
            y1={line.top}
            x2="15"
            y2={line.top + line.height}
            stroke="var(--ax-border-subtle)"
            strokeWidth="2"
          />
        ))}
      </svg>

      {/* Answer items */}
      {answers.map((answer, index) => (
        <div key={answer.fieldId} className={styles.answerItem}>
          <div className={`${styles.answerNumber} js-answer-number`}>
            {index + 1}
          </div>
          <RenderAnswer answer={answer} styles={styles} />
        </div>
      ))}
    </div>
  );
}
