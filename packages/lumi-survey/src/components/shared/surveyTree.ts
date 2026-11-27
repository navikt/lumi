/** What a document and a shadow tree share for looking up focus. */
export type SurveyTree = Pick<Document, "getElementById" | "activeElement">;

/**
 * The document or the shadow tree an element is rendered in. A survey is not
 * always in the document its script runs in: a portal can render it into an
 * iframe, and a web component renders it into a shadow tree. An id that is
 * looked up in the global `document` is not found there.
 */
export const treeOf = (element: Element | null | undefined): SurveyTree => {
  const root = element?.getRootNode() as Partial<SurveyTree> | undefined;
  // Not `instanceof`: the root can belong to another window.
  return root && typeof root.getElementById === "function"
    ? (root as SurveyTree)
    : document;
};

/**
 * True when focus is on no element: on `<body>`, where a browser leaves it
 * when the focused button is disabled.
 */
export const focusIsNowhere = (
  element: Element | null | undefined,
): boolean => {
  const ownerDocument = element?.ownerDocument ?? document;
  return (
    ownerDocument.activeElement === null ||
    ownerDocument.activeElement === ownerDocument.body
  );
};

/**
 * True when focus is on something inside the element. The document or the
 * shadow tree the element is in knows where focus is in it, also in a closed
 * tree and in a tree inside another tree.
 */
export const hasFocusInside = (
  element: Element | null | undefined,
): boolean => {
  const active = treeOf(element).activeElement;
  return Boolean(element && active && element.contains(active));
};

/**
 * Where focus is, seen from the element: the focused element in its
 * document and in each open shadow tree below that, and in each shadow tree
 * the element is in, also a closed one. A document sees only the host of a
 * shadow tree, so a move between two elements in a tree is only seen in the
 * tree.
 */
export const focusPath = (
  element: Element | null | undefined,
): (Element | null)[] => {
  const path: (Element | null)[] = [];
  for (
    let active = (element?.ownerDocument ?? document).activeElement;
    active;
    active = active.shadowRoot?.activeElement ?? null
  ) {
    path.push(active);
  }
  // Not `instanceof ShadowRoot`: the tree can belong to another window.
  for (
    let root = element?.getRootNode();
    root && "host" in root;
    root = (root as ShadowRoot).host.getRootNode()
  ) {
    path.push((root as ShadowRoot).activeElement);
  }
  return path;
};

/**
 * True when the element is in an iframe whose document does not have focus:
 * focus is on the page around the iframe, or in another window. The iframe
 * hears nothing when focus leaves it for the page around it, and moving
 * focus into the iframe would take it from that page.
 */
export const frameHasLostFocus = (
  element: Element | null | undefined,
): boolean => {
  const ownerDocument = element?.ownerDocument ?? document;
  const view = ownerDocument.defaultView;
  // `parent` is the window itself when the window is not in an iframe.
  return Boolean(view && view.parent !== view && !ownerDocument.hasFocus());
};

/**
 * The window a node is shown in. A portal can render the survey into an
 * iframe, whose window is not the one this script runs in.
 */
export const viewOf = (node: Node): Window =>
  node.ownerDocument?.defaultView ?? window;

/**
 * The element around this one on screen. That is the slot it is shown in,
 * the host of the shadow tree it is in, or the iframe of the document it is
 * in when that iframe is on the same site.
 */
export const shownIn = (element: Element): Element | null => {
  if (element.assignedSlot) {
    return element.assignedSlot;
  }
  if (element.parentElement) {
    return element.parentElement;
  }
  const parent = element.parentNode;
  if (parent && "host" in parent) {
    return (parent as ShadowRoot).host;
  }
  try {
    return viewOf(element).frameElement;
  } catch {
    return null;
  }
};

/**
 * The window the element is in, and the windows of the iframes from the same
 * site around it. The page around an iframe can scroll the element away, and
 * a click there is a click outside the element.
 */
export const windowsAround = (element: Element): Window[] => {
  const views = [viewOf(element)];
  for (;;) {
    const current = views[views.length - 1];
    let frame: Element | null = null;
    try {
      frame = current.frameElement;
    } catch {
      frame = null;
    }
    const outer = frame?.ownerDocument.defaultView;
    if (!outer || views.includes(outer)) {
      return views;
    }
    views.push(outer);
  }
};

/**
 * True when no iframe from another site is around the element, so the pages
 * around it can all be measured. The window at the top is its own parent.
 */
export const seesTopWindow = (element: Element): boolean => {
  const views = windowsAround(element);
  const outermost = views[views.length - 1];
  return outermost.parent === outermost;
};

/**
 * Where scroll events from around the element arrive: each shadow tree that
 * holds the element or an element around it on screen, which a scroll event
 * does not leave, and each window around it. A component can show the
 * element in a slot inside a scroll area in its own shadow tree.
 */
export const scrollTargetsAround = (element: Element): EventTarget[] => {
  const targets = new Set<EventTarget>();
  for (let node: Element | null = element; node; node = shownIn(node)) {
    const root = node.getRootNode();
    // Not `instanceof ShadowRoot`: the root can belong to another window.
    if ("host" in root) {
      targets.add(root);
      continue;
    }
    const view = (root as Partial<Document>).defaultView;
    if (view) {
      targets.add(view);
    }
  }
  return [...targets];
};
