import { BodyShort, Hide, HStack, Label, Show, VStack } from "@navikt/ds-react";
import { ChartEmptyState } from "~/components/shared/Charts/ChartEmptyState";
import { ChartLoadingState } from "~/components/shared/Charts/ChartLoadingState";
import { useTheme } from "~/context/ThemeContext";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import {
  getNpsCategory,
  inferRatingVariantFromDistribution,
} from "~/utils/ratingDisplay";

const DEVICE_COLORS: Record<string, string> = {
  desktop: "#60A5FA", // Blue
  mobile: "#34D399", // Green
  tablet: "#FBBF24", // Yellow
  unknown: "#9CA3AF", // Gray
};

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

const CHART_COLORS = {
  text: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.5)",
  tooltip: {
    bg: "#1c1f24",
    border: "rgba(255, 255, 255, 0.15)",
    text: "#ffffff",
  },
};

const CHART_COLORS_LIGHT = {
  text: "#262626", // Nav Gray 90
  textMuted: "#545454", // Nav Gray 60
  tooltip: {
    bg: "#ffffff",
    border: "#a0a0a0", // Nav Gray 40
    text: "#262626",
  },
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

function ratingTextColor(
  averageRating: number,
  variant: "stars" | "emoji" | "thumbs" | "nps",
) {
  if (variant === "thumbs") {
    const p = thumbsPositiveRateFromAverage(averageRating);
    if (p >= 0.75) return "var(--ax-text-success)";
    if (p <= 0.4) return "var(--ax-text-danger)";
    return "var(--ax-text-default)";
  }

  if (variant === "nps") {
    const category = getNpsCategory(averageRating);
    switch (category) {
      case "promoter":
        return "var(--ax-text-success)";
      case "passive":
        return "var(--ax-text-default)";
      case "detractor":
        return "var(--ax-text-danger)";
    }
  }

  if (averageRating >= 4) return "var(--ax-text-success)";
  if (averageRating <= 2) return "var(--ax-text-danger)";
  return "var(--ax-text-default)";
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

export function DeviceBreakdownChart({
  showRating,
}: DeviceBreakdownChartProps = {}) {
  const { data: stats, isPending } = useStats();
  const { theme } = useTheme();
  const { setParams } = useSearchParams();

  const handleDeviceClick = (device: string) => {
    setParams({
      deviceType: device,
      page: "1",
    });
  };

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;

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
      color: DEVICE_COLORS[device] || DEVICE_COLORS.unknown,
    }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) {
    return (
      <ChartEmptyState
        message="Ingen enhetsdata tilgjengelig"
        color={colors.textMuted}
      />
    );
  }

  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <VStack gap="space-16" style={{ width: "100%" }}>
      {/* Mobile: Simple compact list with progress bars */}
      <Hide above="md">
        <VStack gap="space-12" style={{ width: "100%" }}>
          {data.map((d) => {
            const percentage = Math.round((d.count / totalCount) * 100);
            return (
              <button
                type="button"
                key={d.device}
                onClick={() => handleDeviceClick(d.device)}
                style={{
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  padding: 0,
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <HStack justify="space-between" align="center" gap="space-8">
                  <HStack gap="space-8" align="center">
                    <span style={{ fontSize: "1rem" }}>{d.icon}</span>
                    <BodyShort size="small" weight="semibold">
                      {d.label}
                    </BodyShort>
                  </HStack>
                  <HStack gap="space-8" align="center">
                    <BodyShort size="small">{d.count}</BodyShort>
                    {shouldShowRating && d.averageRating != null && (
                      <BodyShort
                        size="small"
                        style={{
                          color: ratingTextColor(
                            d.averageRating,
                            deviceVariant,
                          ),
                        }}
                      >
                        {ratingLabel(d.averageRating, deviceVariant)}
                      </BodyShort>
                    )}
                    <BodyShort size="small" style={{ color: colors.textMuted }}>
                      ({percentage}%)
                    </BodyShort>
                  </HStack>
                </HStack>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    background: "var(--ax-bg-neutral-moderate)",
                    borderRadius: "4px",
                    marginTop: "0.25rem",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${percentage}%`,
                      height: "100%",
                      background: d.color,
                      borderRadius: "4px",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
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
              className="device-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                background: "var(--ax-bg-neutral-soft)",
                cursor: "pointer",
                borderRadius: "6px",
                borderTop: "none",
                borderRight: "none",
                borderBottom: "none",
                borderLeft: `3px solid ${d.color}`,
                font: "inherit",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: "1.25rem", cursor: "inherit" }}>
                {d.icon}
              </span>
              <VStack gap="space-0" style={{ cursor: "inherit" }}>
                <Label size="small" style={{ cursor: "inherit" }}>
                  {d.label}
                </Label>
                <HStack
                  gap="space-8"
                  align="center"
                  style={{ cursor: "inherit" }}
                >
                  <BodyShort
                    size="small"
                    weight="semibold"
                    style={{ cursor: "inherit" }}
                  >
                    {d.count}
                  </BodyShort>
                  <BodyShort
                    size="small"
                    style={{ color: colors.textMuted, cursor: "inherit" }}
                  >
                    ({Math.round((d.count / totalCount) * 100)}%)
                  </BodyShort>
                  {shouldShowRating && (
                    <BodyShort
                      size="small"
                      style={{
                        cursor: "inherit",
                        color:
                          d.averageRating != null
                            ? ratingTextColor(d.averageRating, deviceVariant)
                            : "var(--ax-text-default)",
                      }}
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
