import type { KeyboardEvent } from "react";
import { useCallback } from "react";

interface UseRatingRadioGroupOptions {
  values: readonly number[];
  value: number | null;
  onChange: (value: number) => void;
  disabled: boolean;
}

const isPreviousKey = (key: string): boolean =>
  key === "ArrowLeft" || key === "ArrowUp";

const isNextKey = (key: string): boolean =>
  key === "ArrowRight" || key === "ArrowDown";

/** Implements the WAI-ARIA radio-group keyboard and roving-tabindex pattern. */
export function useRatingRadioGroup({
  values,
  value,
  onChange,
  disabled,
}: UseRatingRadioGroupOptions) {
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (
        disabled ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (!isPreviousKey(event.key) && !isNextKey(event.key))
      ) {
        return;
      }

      const radios = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
          '[role="radio"]:not(:disabled)',
        ),
      );
      if (radios.length === 0) {
        return;
      }

      const focusedIndex = radios.indexOf(event.target as HTMLElement);
      const selectedIndex = value === null ? -1 : values.indexOf(value);
      const currentIndex =
        focusedIndex >= 0 ? focusedIndex : Math.max(selectedIndex, 0);
      const direction = isNextKey(event.key) ? 1 : -1;
      const nextIndex =
        (currentIndex + direction + radios.length) % radios.length;
      const nextValue = values[nextIndex];

      event.preventDefault();
      radios[nextIndex].focus();
      onChange(nextValue);
    },
    [disabled, onChange, value, values],
  );

  const tabbableValue =
    value !== null && values.includes(value) ? value : values[0];
  const getTabIndex = (optionValue: number): 0 | -1 =>
    optionValue === tabbableValue ? 0 : -1;

  return { getTabIndex, onKeyDown };
}
