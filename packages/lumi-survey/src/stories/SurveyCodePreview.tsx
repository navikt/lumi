import { CopyButton } from "@navikt/ds-react";
import { useState } from "react";

interface SurveyCodePreviewProps {
  /**
   * The survey configuration object to display
   */
  survey: unknown;
  /**
   * The context object (tags, etc.) to display
   */
  context?: unknown;
  /**
   * The behavior configuration to display
   */
  behavior?: unknown;
  /**
   * Optional title for the code panel
   * @default "Survey-konfigurasjon"
   */
  title?: string;
  /**
   * Whether to show the code panel collapsed by default
   * @default false
   */
  defaultCollapsed?: boolean;
}

/**
 * A code preview component that displays the survey configuration as formatted TypeScript/JSON.
 * Used in Storybook to help developers understand what configuration produces what UI.
 */
export function SurveyCodePreview({
  survey,
  context,
  behavior,
  title = "Survey-konfigurasjon",
  defaultCollapsed = false,
}: SurveyCodePreviewProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Format the full configuration object - include all non-undefined props
  const fullConfig: Record<string, unknown> = { survey };
  if (context) fullConfig.context = context;
  if (behavior) fullConfig.behavior = behavior;
  const formattedCode = JSON.stringify(fullConfig, null, 2);

  return (
    <div
      style={{
        marginTop: "var(--ax-space-24)",
        background: "var(--ax-bg-neutral)",
        border: "1px solid var(--ax-border-neutral-subtle)",
        borderRadius: "var(--ax-radius-8)",
        overflow: "hidden",
      }}
    >
      {/* Header with title and copy button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--ax-space-12) var(--ax-space-16)",
          background: "var(--ax-bg-neutral-moderate)",
          borderBottom: isCollapsed
            ? "none"
            : "1px solid var(--ax-border-neutral-subtle)",
        }}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--ax-space-8)",
            flex: "1 1 auto",
            width: "100%",
            cursor: "pointer",
            padding: 0,
            border: 0,
            background: "transparent",
            textAlign: "left",
          }}
        >
          <span
            style={{
              transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              display: "inline-block",
            }}
          >
            ▼
          </span>
          <strong style={{ fontSize: "0.875rem" }}>{title}</strong>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--ax-text-neutral-subtle)",
              background: "var(--ax-bg-neutral-soft)",
              padding: "2px 8px",
              borderRadius: "var(--ax-radius-4)",
            }}
          >
            TypeScript
          </span>
        </button>
        <CopyButton copyText={formattedCode} size="small" />
      </div>

      {/* Code content */}
      {!isCollapsed && (
        <pre
          style={{
            margin: 0,
            padding: "var(--ax-space-16)",
            overflow: "auto",
            maxHeight: "400px",
            fontSize: "0.8125rem",
            lineHeight: 1.5,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            background: "var(--ax-bg-neutral)",
          }}
        >
          <code>{formattedCode}</code>
        </pre>
      )}
    </div>
  );
}
