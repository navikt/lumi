import { useMemo, useRef, useSyncExternalStore } from "react";
import type { MouseHandlerDataParam } from "recharts";
import type { TimeBucket } from "~/utils/timeBuckets";

/** Counts on an axis, with a space between thousands. */
export function formatCount(value: number): string {
  return value.toLocaleString("no-NO");
}

/** The index of the point under the mouse, or nothing. */
export function activePointIndex(
  state: Partial<
    Pick<MouseHandlerDataParam, "activeTooltipIndex" | "activeIndex">
  >,
): number | undefined {
  const raw = state.activeTooltipIndex ?? state.activeIndex;
  const index =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : undefined;
  return typeof index === "number" && Number.isFinite(index)
    ? index
    : undefined;
}

/** The point the viewer clicked or points at. */
export function activePoint<P extends { tick: string }>(
  points: P[],
  state: Partial<
    Pick<
      MouseHandlerDataParam,
      "activeTooltipIndex" | "activeIndex" | "activeLabel"
    >
  >,
): P | undefined {
  const index = activePointIndex(state);
  if (index !== undefined) return points[index];
  return typeof state.activeLabel === "string"
    ? points.find((point) => point.tick === state.activeLabel)
    : undefined;
}

/**
 * The search that opens a bucket's days in the period on Tilbakemeldinger.
 * The filters only Tilbakemeldinger applies are left out, since the charts
 * count without them. A filter can linger in the address after a visit
 * there, such as a phrase chosen under Hindringer.
 */
export function bucketFeedbackSearch<P extends object>(
  params: P,
  bucket: Pick<TimeBucket, "firstDay" | "lastDay">,
) {
  return {
    ...params,
    hasText: undefined,
    lowRating: undefined,
    query: undefined,
    tag: undefined,
    theme: undefined,
    phrase: undefined,
    dateMode: "fixed" as const,
    fromDate: bucket.firstDay,
    toDate: bucket.lastDay,
    periodPreset: undefined,
    page: "1",
  };
}

/** How long after a finger leaves the screen its click can still come. */
const CLICK_AFTER_TOUCH_MS = 600;

/**
 * A tap on a touch screen also gives a click, before recharts has moved to
 * the tapped point, and the click would open the point touched before. A
 * tap therefore only shows the tooltip. The table's links open the answers.
 *
 * Browsers that tell the pointer type of a click decide it. Others count a
 * click as a tap while a finger is on the screen and just after it leaves,
 * so a long press is caught too.
 */
export function useTapGuard() {
  const touching = useRef(false);
  const touchEndedAt = useRef(Number.NEGATIVE_INFINITY);
  return useMemo(
    () => ({
      onTouchStart: () => {
        touching.current = true;
      },
      onTouchEnd: () => {
        touching.current = false;
        touchEndedAt.current = Date.now();
      },
      isTap: (event?: { nativeEvent?: Event }) => {
        const pointerType = (event?.nativeEvent as PointerEvent | undefined)
          ?.pointerType;
        if (pointerType) return pointerType === "touch";
        return (
          touching.current ||
          Date.now() - touchEndedAt.current < CLICK_AFTER_TOUCH_MS
        );
      },
    }),
    [],
  );
}

const HOVER_QUERY = "(hover: hover)";

function subscribeToHover(onChange: () => void) {
  const query = window.matchMedia(HOVER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the main pointer can hover, as a mouse can and a finger cannot. */
function useCanHover(): boolean {
  return useSyncExternalStore(
    subscribeToHover,
    () => window.matchMedia(HOVER_QUERY).matches,
    () => true,
  );
}

/**
 * The tooltip's hint about opening a bucket's answers. A tap only shows the
 * tooltip, so a touch screen points to the table instead.
 */
export function DrilldownHint({ className }: { className?: string }) {
  const canHover = useCanHover();
  return (
    <div className={className}>
      {canHover
        ? "Klikk for å åpne tilbakemeldinger"
        : "Velg Vis som tabell for å åpne svarene"}
    </div>
  );
}

interface PartialDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  stroke?: string;
  payload?: { start?: string; partial?: boolean };
}

/** How a line chart draws a partial week or month, for the note under it. */
export const PARTIAL_DOT_LOOK = { one: "hul prikk", many: "hule prikker" };

/** The same for a chart with several lines, which has a point on each. */
export const PARTIAL_DOTS_LOOK = { one: "hule prikker", many: "hule prikker" };

/**
 * A point on a line. A week or month only partly in the period gets a
 * hollow point, filled with the card's background.
 */
export function PartialDot({
  cx,
  cy,
  index,
  stroke,
  payload,
}: PartialDotProps) {
  if (typeof cx !== "number" || typeof cy !== "number") {
    return <g key={`empty-${index}`} />;
  }
  const partial = payload?.partial ?? false;
  return (
    <circle
      key={payload?.start ?? index}
      cx={cx}
      cy={cy}
      r={4}
      fill={partial ? "var(--ax-bg-raised)" : stroke}
      stroke={stroke}
      strokeWidth={partial ? 2 : 0}
    />
  );
}
