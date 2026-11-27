import type React from "react";
import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import {
  frameHasLostFocus,
  hasFocusInside,
  windowsAround,
} from "./surveyTree.js";

/** Handlers for the element that wraps the survey. */
export interface UserInSurveyHandlers {
  onFocusCapture: (event: React.FocusEvent<HTMLElement>) => void;
  onBlurCapture: (event: React.FocusEvent<HTMLElement>) => void;
  onClickCapture: (event: React.MouseEvent<HTMLElement>) => void;
}

export interface UserInSurvey {
  handlers: UserInSurveyHandlers;
  /**
   * True while the user is in the survey: focus or the last click is in it,
   * and the user has not moved on to the page since.
   */
  isIn: () => boolean;
  /** Says that the user has left the survey, as when it is closed. */
  leave: () => void;
}

/**
 * Follows whether the user is in the survey, so focus can be kept there when
 * a submit ends without being taken from the page.
 *
 * Focus in the survey and a click in it say that the user is there. Safari
 * does not move focus to a clicked button, and a screen reader can press one
 * without moving focus. Focus or a click anywhere else says that the user has
 * left, also in an element the app renders from the survey through a portal.
 * A browser moves focus to `<body>` without a blur event when the focused
 * submit button is disabled, so the survey also listens on its document, and
 * for clicks on the pages around an iframe it is in. The listeners are added
 * the first time the user is in the survey, and listen as the event comes
 * down, so a dialog on the page that stops it cannot hide it.
 *
 * `onInteraction` is called when the user moves focus into the survey or
 * clicks in it.
 */
export function useUserInSurvey(
  rootRef: RefObject<HTMLElement | null>,
  onInteraction: () => void,
): UserInSurvey {
  const inRef = useRef(false);
  const onInteractionRef = useRef(onInteraction);
  onInteractionRef.current = onInteraction;
  const stopListeningRef = useRef<(() => void) | null>(null);

  // Hidden or gone, as when React hides the survey with `<Activity>`, the
  // survey hears nothing, so the user is not in it.
  useEffect(
    () => () => {
      stopListeningRef.current?.();
      stopListeningRef.current = null;
      inRef.current = false;
    },
    [],
  );

  const listenOutside = useCallback(
    (root: Element) => {
      if (stopListeningRef.current) {
        return;
      }
      const ownerDocument = root.ownerDocument;
      // Focus events leave a shadow tree with its host as the target, and a
      // closed tree hides where in it focus is. The tree the survey is in
      // knows, also inside another tree.
      const handleFocusIn = () => {
        const current = rootRef.current;
        if (current && !hasFocusInside(current)) {
          inRef.current = false;
        }
      };
      // React can listen on the document itself, as when an app hydrates the
      // whole document, and then hears a click before this does. A click in
      // the survey is therefore known by its path.
      const handleClick = (event: Event) => {
        const current = rootRef.current;
        if (!current || !event.composedPath().includes(current)) {
          inRef.current = false;
        }
      };
      const documents = windowsAround(root).map((view) => view.document);
      ownerDocument.addEventListener("focusin", handleFocusIn, true);
      for (const clicked of documents) {
        clicked.addEventListener("click", handleClick, true);
      }
      stopListeningRef.current = () => {
        ownerDocument.removeEventListener("focusin", handleFocusIn, true);
        for (const clicked of documents) {
          clicked.removeEventListener("click", handleClick, true);
        }
      };
    },
    [rootRef],
  );

  // React passes on events from a portal in the survey's tree, such as a
  // dialog the app opens from the survey. The portal can be in another
  // document, where the listeners on the survey's document hear nothing.
  const enter = useCallback(
    (event: React.SyntheticEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.target as Node)) {
        inRef.current = false;
        return;
      }
      inRef.current = true;
      listenOutside(event.currentTarget);
      onInteractionRef.current();
    },
    [listenOutside],
  );

  // Focus that leaves an element in a portal has already left the survey,
  // so only where focus goes matters. Not `instanceof Node`: in an iframe,
  // that element belongs to the iframe's window.
  const onBlurCapture = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Partial<Node> | null;
    if (
      typeof next?.nodeType === "number" &&
      !event.currentTarget.contains(next as Node)
    ) {
      inRef.current = false;
    }
  }, []);

  return useMemo(
    () => ({
      handlers: {
        onFocusCapture: enter,
        onBlurCapture,
        onClickCapture: enter,
      },
      // An iframe hears nothing when focus moves to the page around it.
      isIn: () => inRef.current && !frameHasLostFocus(rootRef.current),
      leave: () => {
        inRef.current = false;
      },
    }),
    [enter, onBlurCapture, rootRef],
  );
}
