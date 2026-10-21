export type Point = readonly [number, number];

function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function towards(from: Point, to: Point, length: number): Point {
  const total = distance(from, to);
  if (total === 0) return from;
  const t = length / total;
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

/**
 * An SVG path through the points with rounded corners, like the bends on a
 * transit map. Keep segments at 0, 45 or 90 degrees.
 */
export function roundedPath(points: readonly Point[], radius = 48): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  let d = `M${first[0]} ${first[1]}`;
  rest.forEach((point, i) => {
    const previous = points[i];
    const next = rest[i + 1];
    if (!next) {
      d += ` L${point[0]} ${point[1]}`;
      return;
    }
    const r = Math.min(
      radius,
      distance(previous, point) / 2,
      distance(point, next) / 2,
    );
    const start = towards(point, previous, r);
    const end = towards(point, next, r);
    d += ` L${start[0]} ${start[1]} Q${point[0]} ${point[1]} ${end[0]} ${end[1]}`;
  });
  return d;
}

/** Points along a polyline at fractions of its length, for moving markers. */
export function pointAt(points: readonly Point[], fraction: number): Point {
  if (points.length === 0) return [0, 0];
  const lengths = points.slice(1).map((point, i) => distance(points[i], point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = Math.min(Math.max(fraction, 0), 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      return towards(points[i], points[i + 1], remaining);
    }
    remaining -= lengths[i];
  }
  return points[points.length - 1];
}
