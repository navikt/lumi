/** Nav pages, and the decorator's skip link, use this id for the main region. */
const MAIN_CONTENT_ID = "maincontent";

const tryFocus = (element: HTMLElement, options?: FocusOptions): boolean => {
  element.focus(options);
  return element.ownerDocument.activeElement === element;
};

/**
 * Focus a landmark that is not focusable by default. A temporary
 * `tabindex="-1"` is removed again when focus leaves, so the host page keeps
 * its own tab order.
 */
const focusLandmark = (element: HTMLElement): boolean => {
  // Focusing a large landmark must not scroll the page away from where the
  // user was working.
  const options: FocusOptions = { preventScroll: true };
  // <body> is the active element whenever nothing has focus, so a successful
  // check proves nothing until it is really focusable.
  const isBody = element === element.ownerDocument.body;

  if (!isBody && tryFocus(element, options)) {
    return true;
  }
  if (element.hasAttribute("tabindex")) {
    return isBody && tryFocus(element, options);
  }

  element.setAttribute("tabindex", "-1");
  if (tryFocus(element, options)) {
    element.addEventListener(
      "blur",
      () => element.removeAttribute("tabindex"),
      { once: true },
    );
    return true;
  }

  element.removeAttribute("tabindex");
  return false;
};

/**
 * Return focus to the host page after the dock has disappeared. Prefer the
 * element that had focus before the dock, then `#maincontent`, then `<body>`.
 */
export const returnFocusToPage = (previous: HTMLElement | null): void => {
  if (typeof document === "undefined") {
    return;
  }

  // <body> is where focus rests when nothing had it, not a real target.
  if (
    previous &&
    previous !== document.body &&
    previous.isConnected &&
    tryFocus(previous)
  ) {
    return;
  }

  const mainContent = document.getElementById(MAIN_CONTENT_ID);
  if (mainContent && focusLandmark(mainContent)) {
    return;
  }

  focusLandmark(document.body);
};
