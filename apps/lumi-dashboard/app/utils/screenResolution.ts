export const SCREEN_RESOLUTION_BUCKET_ORDER = [
  "under-1280",
  "1280-1919",
  "1920-2559",
  "2560-plus",
] as const;

export type ScreenResolutionBucket =
  (typeof SCREEN_RESOLUTION_BUCKET_ORDER)[number];

export const SCREEN_RESOLUTION_LABELS: Record<ScreenResolutionBucket, string> =
  {
    "under-1280": "Under 1280 px",
    "1280-1919": "1280–1919 px",
    "1920-2559": "1920–2559 px",
    "2560-plus": "2560 px eller mer",
  };

export function getScreenResolutionBucket(
  width: number | undefined,
  height: number | undefined,
): ScreenResolutionBucket | undefined {
  if (!width || !height || width <= 0 || height <= 0) return undefined;

  const longestEdge = Math.max(width, height);
  if (longestEdge < 1280) return "under-1280";
  if (longestEdge < 1920) return "1280-1919";
  if (longestEdge < 2560) return "1920-2559";
  return "2560-plus";
}
