import { type RefObject, useLayoutEffect, useState } from "react";

export interface Size {
  width: number;
  height: number;
}

/**
 * Layout size of an element, ignoring CSS transforms. Measured before the
 * first paint and kept current with a ResizeObserver.
 */
export function useElementSize(
  ref: RefObject<HTMLElement | null>,
): Size | null {
  const [size, setSize] = useState<Size | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = (width: number, height: number) => {
      // Hidden elements can report zero. Keep the last usable size.
      if (width < 1 || height < 1) return;
      setSize((previous) =>
        previous && previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    };
    update(element.clientWidth, element.clientHeight);
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) update(rect.width, rect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
