import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

declare global {
  interface Window {
    /**
     * The shadow trees the stories have made, so a browser test can look
     * into a closed tree. Only the stories set it.
     */
    lumiStoryShadowRoots?: ShadowRoot[];
  }
}

/**
 * Renders `children` in a shadow tree, for the stories the browser tests
 * open. The host carries `data-shadow-host`, so a test can find it. Styles
 * from the page do not reach into the tree.
 */
export const ShadowHost = ({
  children,
  mode = "open",
}: {
  children: ReactNode;
  mode?: ShadowRootMode;
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  // A closed tree is not on its host, so the tree is kept here.
  const shadowRef = useRef<ShadowRoot | null>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // An effect can run twice in development. The tree stays the same.
    if (!shadowRef.current) {
      shadowRef.current = host.attachShadow({ mode });
      window.lumiStoryShadowRoots = [
        ...(window.lumiStoryShadowRoots ?? []),
        shadowRef.current,
      ];
    }
    const shadow = shadowRef.current;
    const existing = shadow.firstElementChild;
    setMount(
      existing instanceof HTMLElement
        ? existing
        : shadow.appendChild(document.createElement("div")),
    );
  }, [mode]);
  return (
    <div ref={hostRef} data-shadow-host>
      {mount ? createPortal(children, mount) : null}
    </div>
  );
};
