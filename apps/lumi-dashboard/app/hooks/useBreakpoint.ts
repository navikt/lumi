import { useEffect, useState } from "react";

/**
 * Aksel breakpoint values in pixels.
 * These match the design tokens from @navikt/ds-tokens.
 */
export const breakpoints = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1440,
} as const;

export type Breakpoint = keyof typeof breakpoints;

interface BreakpointState {
  /** Current viewport width in pixels */
  width: number;
  /** Current breakpoint name */
  breakpoint: Breakpoint;
  /** True if viewport is below md (768px) - phones */
  isMobile: boolean;
  /** True if viewport is md to lg (768px-1023px) - tablets */
  isTablet: boolean;
  /** True if viewport is lg and above (1024px+) - desktops */
  isDesktop: boolean;
  /** Check if viewport is at or above a specific breakpoint */
  isAbove: (bp: Breakpoint) => boolean;
  /** Check if viewport is below a specific breakpoint */
  isBelow: (bp: Breakpoint) => boolean;
}

/**
 * Hook for responsive behavior that can't be achieved with CSS alone.
 * Use sparingly - prefer Aksel's Hide/Show components when possible.
 *
 * @example
 * ```tsx
 * const { isMobile, isAbove } = useBreakpoint();
 *
 * // Conditional rendering
 * if (isMobile) return <MobileView />;
 *
 * // Check specific breakpoint
 * const showSidebar = isAbove("lg");
 * ```
 */
export function useBreakpoint(): BreakpointState {
  const [width, setWidth] = useState(() => {
    // SSR-safe: default to desktop width during server rendering
    if (typeof window === "undefined") return breakpoints.lg;
    return window.innerWidth;
  });

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    // Set initial width on mount (handles SSR hydration)
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getBreakpoint = (w: number): Breakpoint => {
    if (w >= breakpoints["2xl"]) return "2xl";
    if (w >= breakpoints.xl) return "xl";
    if (w >= breakpoints.lg) return "lg";
    if (w >= breakpoints.md) return "md";
    if (w >= breakpoints.sm) return "sm";
    return "xs";
  };

  const breakpoint = getBreakpoint(width);

  const isAbove = (bp: Breakpoint): boolean => {
    return width >= breakpoints[bp];
  };

  const isBelow = (bp: Breakpoint): boolean => {
    return width < breakpoints[bp];
  };

  return {
    width,
    breakpoint,
    isMobile: width < breakpoints.md,
    isTablet: width >= breakpoints.md && width < breakpoints.lg,
    isDesktop: width >= breakpoints.lg,
    isAbove,
    isBelow,
  };
}
