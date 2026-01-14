import { BodyShort } from "@navikt/ds-react";
import React, { type ReactNode } from "react";

export interface EmojiButtonProps {
  feedback: number;
  activeState: number | null;
  setActiveState: (state: number) => void;
  children: ReactNode;
  text: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  ariaLabel?: string;
  renderText?: boolean;
}

export const EmojiButton = React.forwardRef<
  HTMLButtonElement,
  EmojiButtonProps
>(
  (
    {
      feedback,
      activeState,
      setActiveState,
      children,
      text,
      className,
      style,
      disabled,
      ariaLabel,
      renderText = true,
    },
    ref,
  ) => {
    const isActive = activeState === feedback;

    return (
      <button
        ref={ref}
        type="button"
        className={className}
        onClick={() => setActiveState(feedback)}
        aria-checked={isActive}
        role="radio"
        aria-label={ariaLabel ?? text}
        disabled={disabled}
        style={style}
        tabIndex={isActive || activeState === null ? 0 : -1}
      >
        {children}
        {renderText && <BodyShort>{text}</BodyShort>}
      </button>
    );
  },
);

EmojiButton.displayName = "EmojiButton";
