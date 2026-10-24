import type { CSSProperties } from "react";

export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

/** Inline CSS custom properties, typed for the `style` prop. */
export function cssVars(
  vars: Record<`--${string}`, string | number>,
): CSSProperties {
  return vars as CSSProperties;
}
