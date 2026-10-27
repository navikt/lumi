const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Controls that own the keys and touches that start on them. */
export const INTERACTIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  "[data-deck-interactive]",
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="textbox"]',
].join(", ");

export function isTextEntry(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(element.type);
  }
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  const role = element.getAttribute("role");
  return role === "textbox" || role === "searchbox" || role === "combobox";
}

/**
 * Who owns a key press:
 * - "text": a text field. Deck shortcuts are off, PageUp/PageDown included.
 * - "slide-control": a control inside slide content, like the live widget.
 *   Only PageUp/PageDown (presenter clickers) reach the deck.
 * - "control": deck chrome, like the navigation strip. Space and Enter
 *   belong to the control, other shortcuts still work.
 * - "deck": everything else.
 */
export type KeyScope = "text" | "slide-control" | "control" | "deck";

export function keyScope(target: Element | null): KeyScope {
  if (!target) return "deck";
  if (isTextEntry(target)) return "text";
  const control = target.closest(INTERACTIVE_SELECTOR);
  if (!control) return "deck";
  return control.closest("[data-slide-id]") ? "slide-control" : "control";
}

/** True when focus sits inside slide content, for example in the widget. */
export function isInsideSlide(target: Element | null): boolean {
  return Boolean(target?.closest("[data-slide-id]"));
}
