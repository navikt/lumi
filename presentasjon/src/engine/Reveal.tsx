import type { CSSProperties, ReactNode } from "react";
import { useSlide } from "./SlideContext";

type RevealTag = "div" | "span" | "li" | "p" | "section";

export interface RevealProps {
  /** First build step at which the content is shown. */
  at: number;
  as?: RevealTag;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * Shows its content from build step `at`, with a transition that respects
 * reduced motion. Any element with `data-from="n"` behaves the same way
 * without a wrapper component.
 */
export function Reveal({
  at,
  as: Tag = "div",
  className,
  style,
  children,
}: RevealProps) {
  const { step } = useSlide();
  return (
    <Tag
      className={className}
      style={style}
      data-reveal=""
      data-revealed={step >= at ? "" : undefined}
    >
      {children}
    </Tag>
  );
}
