/**
 * True when no element has focus, for example after the focused button was
 * removed or disabled. Moving focus then does not take it from the user.
 */
export function focusIsLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body;
}

/**
 * True when focus is lost or still on `origin`, the element whose action is
 * about to move it. Moving focus then does not take it from the user.
 */
export function focusStayedOn(origin: Element | null | undefined): boolean {
  return focusIsLost() || document.activeElement === origin;
}

/**
 * Focuses the page heading when focus is lost, or when it is still on
 * `origin`. The heading gets tabindex -1, so it can take focus without
 * becoming a tab stop.
 */
export function focusPageHeading(origin?: Element | null): void {
  if (!focusStayedOn(origin)) return;
  const heading = document.querySelector<HTMLElement>("main h1");
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus();
}
