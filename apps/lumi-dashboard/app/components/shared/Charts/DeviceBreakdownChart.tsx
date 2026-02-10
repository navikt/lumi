import { BodyShort, Hide, HStack, Label, Show, VStack } from "@navikt/ds-react";
import { ChartEmptyState } from "~/components/shared/Charts/ChartEmptyState";
import { ChartLoadingState } from "~/components/shared/Charts/ChartLoadingState";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import {
  getNpsCategory,
  inferRatingVariantFromDistribution,
} from "~/utils/ratingDisplay";
import styles from "./Charts.module.css";

const DEVICE_ICONS: Record<string, string> = {
  desktop: "🖥️",
  mobile: "📱",
  tablet: "📱",
  unknown: "❓",
};

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobil",
  tablet: "Nettbrett",
  unknown: "Ukjent",
};

const DEVICE_COLOR_CLASS_BY_KEY: Record<string, string> = {
  desktop: styles.deviceColorDesktop,
  mobile: styles.deviceColorMobile,
  tablet: styles.deviceColorTablet,
  unknown: styles.deviceColorUnknown,
};

interface DeviceBreakdownChartProps {
  /** Override rating visibility. If not provided, auto-detects based on survey type. */
  showRating?: boolean;
}

function clamp01(value: number) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function thumbsPositiveRateFromAverage(averageRating: number) {
  // Thumbs is stored as 1=down, 2=up.
  // Expected value: E[rating] = 1 + p(up) => p(up) = average - 1.
  return clamp01(averageRating - 1);
}

function ratingTone(
  averageRating: number,
  variant: "stars" | "emoji" | "thumbs" | "nps",
): "positive" | "negative" | "neutral" {
  if (variant === "thumbs") {
    const p = thumbsPositiveRateFromAverage(averageRating);
    if (p >= 0.75) return "positive";
    if (p <= 0.4) return "negative";
    return "neutral";
  }

  if (variant === "nps") {
    const category = getNpsCategory(averageRating);
    switch (category) {
      case "promoter":
        return "positive";
      case "passive":
        return "neutral";
      case "detractor":
        return "negative";
    }
  }

  if (averageRating >= 4) return "positive";
  if (averageRating <= 2) return "negative";
  return "neutral";
}

function ratingLabel(
  averageRating: number,
  variant: "stars" | "emoji" | "thumbs" | "nps",
) {
  if (variant === "thumbs") {
    const p = thumbsPositiveRateFromAverage(averageRating);
    return `👍 ${Math.round(p * 100)}%`;
  }

  if (variant === "nps") {
    return `${Math.round(averageRating)}/10`;
  }

  return `⭐ ${averageRating.toFixed(1)}`;
}

function ratingToneClass(
  averageRating: number,
  variant: "stars" | "emoji" | "thumbs" | "nps",
): string {
  const tone = ratingTone(averageRating, variant);
  switch (tone) {
    case "positive":
      return styles.deviceTonePositive;
    case "negative":
      return styles.deviceToneNegative;
    case "neutral":
      return styles.deviceToneNeutral;
  }
}

export function DeviceBreakdownChart({
  showRating,
}: DeviceBreakdownChartProps = {}) {
  const { data: stats, isPending } = useStats();
  const { setParams } = useSearchParams();

  const handleDeviceClick = (device: string) => {
    setParams({
      deviceType: device,
      page: "1",
    });
  };

  // Auto-detect whether to show rating based on survey type
  // Rating is only relevant for "rating" and "custom" surveys
  const surveyType = stats?.surveyType;
  const shouldShowRating =
    showRating ?? (surveyType === "rating" || surveyType === "custom");

  const ratingVariant = inferRatingVariantFromDistribution(stats?.byRating);
  const deviceVariant: "stars" | "emoji" | "thumbs" | "nps" =
    ratingVariant === "thumbs" || ratingVariant === "nps"
      ? ratingVariant
      : "stars";

  if (isPending) {
    return <ChartLoadingState />;
  }

  const byDevice = stats?.byDevice || {};

  // Transform to array and sort by count
  const data = Object.entries(byDevice)
    .filter(([device]) => device !== "unknown")
    .map(([device, { count, averageRating }]) => ({
      device,
      label: DEVICE_LABELS[device] || device,
      icon: DEVICE_ICONS[device] || "❓",
      count,
      averageRating,
    }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) {
    return <ChartEmptyState message="Ingen enhetsdata tilgjengelig" />;
  }

  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <VStack gap="space-16" className={styles.fullWidth}>
      {/* Mobile: Simple compact list with progress bars */}
      <Hide above="md">
        <VStack gap="space-12" className={styles.fullWidth}>
          {data.map((d) => {
            const percentage = Math.round((d.count / totalCount) * 100);
            const deviceColorClass =
              DEVICE_COLOR_CLASS_BY_KEY[d.device] ?? styles.deviceColorUnknown;
            return (
              <button
                type="button"
                key={d.device}
                onClick={() => handleDeviceClick(d.device)}
                className={[styles.deviceListButton, deviceColorClass].join(
                  " ",
                )}
              >
                <HStack justify="space-between" align="center" gap="space-8">
                  <HStack gap="space-8" align="center">
                    <span className={styles.deviceIconSmall}>{d.icon}</span>
                    <BodyShort size="small" weight="semibold">
                      {d.label}
                    </BodyShort>
                  </HStack>
                  <HStack gap="space-8" align="center">
                    <BodyShort size="small">{d.count}</BodyShort>
                    {shouldShowRating && d.averageRating != null && (
                      <BodyShort
                        size="small"
                        className={ratingToneClass(
                          d.averageRating,
                          deviceVariant,
                        )}
                      >
                        {ratingLabel(d.averageRating, deviceVariant)}
                      </BodyShort>
                    )}
                    <BodyShort size="small" className={styles.deviceMutedText}>
                      ({percentage}%)
                    </BodyShort>
                  </HStack>
                </HStack>
                <progress
                  className={styles.deviceProgress}
                  value={percentage}
                  max={100}
                  aria-label={`Andel for ${d.label}`}
                />
              </button>
            );
          })}
        </VStack>
      </Hide>
      {/* Desktop: Cards + Bar chart */}
      <Show above="md">
        {/* Summary cards */}
        <HStack gap="space-16" wrap>
          {data.map((d) => (
            <button
              type="button"
              key={d.device}
              onClick={() => handleDeviceClick(d.device)}
              className={[
                styles.deviceCard,
                DEVICE_COLOR_CLASS_BY_KEY[d.device] ??
                  styles.deviceColorUnknown,
              ].join(" ")}
            >
              <span className={styles.deviceIconLarge}>{d.icon}</span>
              <VStack gap="space-0">
                <Label size="small">{d.label}</Label>
                <HStack gap="space-8" align="center">
                  <BodyShort size="small" weight="semibold">
                    {d.count}
                  </BodyShort>
                  <BodyShort size="small" className={styles.deviceMutedText}>
                    ({Math.round((d.count / totalCount) * 100)}%)
                  </BodyShort>
                  {shouldShowRating && (
                    <BodyShort
                      size="small"
                      className={
                        d.averageRating != null
                          ? ratingToneClass(d.averageRating, deviceVariant)
                          : styles.deviceToneNeutral
                      }
                    >
                      {d.averageRating != null
                        ? ratingLabel(d.averageRating, deviceVariant)
                        : null}
                    </BodyShort>
                  )}
                </HStack>
              </VStack>
            </button>
          ))}
        </HStack>
      </Show>
    </VStack>
  );
}
