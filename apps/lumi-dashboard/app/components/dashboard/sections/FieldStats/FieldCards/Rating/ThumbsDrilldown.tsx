import { HStack, VStack } from "@navikt/ds-react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";

function calculatePct(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export function ThumbsDrilldown({
  fieldId,
  distribution,
  fieldTotalResponses,
  activeRatingValue,
  isFilteringThisField,
  onSelect,
  onClear,
}: {
  fieldId: string;
  distribution: Record<string, number>;
  fieldTotalResponses: number;
  activeRatingValue: string | undefined;
  isFilteringThisField: boolean;
  onSelect: (ratingValue: "1" | "2") => void;
  onClear: () => void;
}) {
  return (
    <VStack gap="space-12" marginBlock="space-12 space-0">
      <div style={{ height: 200, width: "100%" }}>
        <ResponsiveContainerWithInitialSize
          width="100%"
          height="100%"
          minWidth={2}
          minHeight={2}
        >
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Tooltip
              formatter={(value, name) => {
                const safeValue = typeof value === "number" ? value : 0;
                const pct = calculatePct(safeValue, fieldTotalResponses);
                return [`${safeValue} (${pct}%)`, name];
              }}
            />
            <Pie
              data={[
                { name: "Ja", value: distribution["2"] || 0, ratingValue: "2" },
                {
                  name: "Nei",
                  value: distribution["1"] || 0,
                  ratingValue: "1",
                },
              ].filter((d) => d.value > 0)}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={90}
              paddingAngle={3}
              stroke="var(--ax-border-neutral-subtle)"
              strokeWidth={1}
              onClick={(slice) => {
                const nextValue = String(
                  (slice as unknown as { ratingValue: "1" | "2" }).ratingValue,
                ) as "1" | "2";
                onSelect(nextValue);
              }}
              style={{ cursor: "pointer" }}
            >
              <Cell
                fill="var(--ax-bg-success-strong)"
                opacity={
                  !isFilteringThisField || activeRatingValue === "2" ? 1 : 0.35
                }
              />
              <Cell
                fill="var(--ax-bg-danger-strong)"
                opacity={
                  !isFilteringThisField || activeRatingValue === "1" ? 1 : 0.35
                }
              />
            </Pie>

            {(() => {
              const up = distribution["2"] || 0;
              const down = distribution["1"] || 0;
              const pct = calculatePct(up, up + down);
              return (
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fill: "var(--ax-text-neutral)",
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  {pct}%
                </text>
              );
            })()}
          </PieChart>
        </ResponsiveContainerWithInitialSize>
      </div>

      <HStack gap="space-8" wrap>
        {(
          [
            {
              label: "👍 Ja",
              value: "2" as const,
              color: "var(--ax-bg-success-strong)",
            },
            {
              label: "👎 Nei",
              value: "1" as const,
              color: "var(--ax-bg-danger-strong)",
            },
          ] as const
        ).map((item) => {
          const count = distribution[item.value] || 0;
          const pct = calculatePct(count, fieldTotalResponses);
          const isSelected =
            isFilteringThisField && activeRatingValue === item.value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onSelect(item.value)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: isSelected
                  ? "2px solid var(--ax-border-neutral)"
                  : "1px solid var(--ax-border-neutral-subtle)",
                background: "var(--ax-bg-default)",
                cursor: "pointer",
              }}
              aria-pressed={isSelected}
              data-testid={`thumbs-drilldown-${fieldId}-${item.value}`}
            >
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: item.color,
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                {item.label}
              </span>
              <span
                style={{
                  fontSize: "0.875rem",
                  color: "var(--ax-text-neutral-subtle)",
                }}
              >
                {pct}% ({count})
              </span>
            </button>
          );
        })}

        {isFilteringThisField ? (
          <button
            type="button"
            onClick={onClear}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px dashed var(--ax-border-neutral-subtle)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--ax-text-neutral-subtle)",
              fontSize: "0.875rem",
            }}
          >
            Nullstill
          </button>
        ) : null}
      </HStack>
    </VStack>
  );
}
