import { CopyButton } from "@navikt/ds-react";
import { useState } from "react";
import type {
  LumiSurveyConfig,
  SurveyDocumentV1,
} from "../components/surveyTypes.js";

interface CodePreviewProps {
  code: string;
  title: string;
  badge: string;
  note?: string;
  tone?: "current" | "legacy" | "payload";
  defaultCollapsed?: boolean;
}

interface SurveyCodePreviewProps {
  survey: LumiSurveyConfig | SurveyDocumentV1;
  context?: unknown;
  behavior?: unknown;
  sourceCode?: string;
  defaultCollapsed?: boolean;
}

function isSurveyDocumentV1(
  survey: LumiSurveyConfig | SurveyDocumentV1,
): survey is SurveyDocumentV1 {
  return "authoringSchemaVersion" in survey;
}

function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildSurveySource({
  survey,
  context,
  behavior,
}: Pick<SurveyCodePreviewProps, "survey" | "context" | "behavior">): string {
  const currentDocument = isSurveyDocumentV1(survey);
  const typeName = currentDocument ? "SurveyDocumentV1" : "LumiSurveyConfig";
  const importedTypes = [typeName];
  if (context !== undefined) {
    importedTypes.push("LumiSurveyContext");
  }
  if (behavior !== undefined) {
    importedTypes.push("LumiSurveyBehavior");
  }
  const imports = `import type { ${importedTypes.join(", ")} } from "@navikt/lumi-survey";`;
  const sections = [
    imports,
    "",
    `const survey = ${serialize(survey)} satisfies ${typeName};`,
  ];

  if (context !== undefined) {
    sections.push(
      "",
      `const context = ${serialize(context)} satisfies LumiSurveyContext;`,
    );
  }
  if (behavior !== undefined) {
    sections.push(
      "",
      `const behavior = ${serialize(behavior)} satisfies LumiSurveyBehavior;`,
    );
  }

  return sections.join("\n");
}

export function CodePreview({
  code,
  title,
  badge,
  note,
  tone = "current",
  defaultCollapsed = false,
}: CodePreviewProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const toneStyles = {
    current: {
      badgeBackground: "var(--ax-bg-success-soft)",
      badgeColor: "var(--ax-text-success-subtle)",
      noteBackground: "var(--ax-bg-info-soft)",
      noteColor: "var(--ax-text-neutral)",
    },
    legacy: {
      badgeBackground: "var(--ax-bg-warning-soft)",
      badgeColor: "var(--ax-text-warning-subtle)",
      noteBackground: "var(--ax-bg-warning-soft)",
      noteColor: "var(--ax-text-neutral)",
    },
    payload: {
      badgeBackground: "var(--ax-bg-accent-soft)",
      badgeColor: "var(--ax-text-accent-subtle)",
      noteBackground: "var(--ax-bg-accent-soft)",
      noteColor: "var(--ax-text-neutral)",
    },
  }[tone];

  return (
    <section
      style={{
        background: "var(--ax-bg-default)",
        border: "1px solid var(--ax-border-neutral-subtle)",
        borderRadius: "var(--ax-radius-8)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--ax-space-12)",
          padding: "var(--ax-space-12) var(--ax-space-16)",
          background: "var(--ax-bg-neutral-soft)",
          borderBottom: isCollapsed
            ? "none"
            : "1px solid var(--ax-border-neutral-subtle)",
        }}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          aria-expanded={!isCollapsed}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--ax-space-8)",
            flex: "1 1 auto",
            minWidth: 0,
            padding: 0,
            border: 0,
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span aria-hidden="true">{isCollapsed ? "▶" : "▼"}</span>
          <strong style={{ fontSize: "0.875rem" }}>{title}</strong>
          <span
            className="lumi-storybook-code-preview__badge"
            style={{
              padding: "2px var(--ax-space-8)",
              borderRadius: "var(--ax-radius-full)",
              background: toneStyles.badgeBackground,
              color: toneStyles.badgeColor,
              fontSize: "0.75rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {badge}
          </span>
        </button>
        <CopyButton copyText={code} size="small" />
      </div>

      {!isCollapsed && (
        <>
          {note && (
            <p
              style={{
                margin: 0,
                padding: "var(--ax-space-12) var(--ax-space-16)",
                background: toneStyles.noteBackground,
                color: toneStyles.noteColor,
                fontSize: "0.8125rem",
              }}
            >
              {note}
            </p>
          )}
          <section
            aria-label={`${title} kode`}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: axe requires scrollable code regions to be keyboard-focusable.
            tabIndex={0}
            style={{
              padding: "var(--ax-space-16)",
              overflow: "auto",
              maxHeight: "520px",
              background: "var(--ax-bg-default)",
              color: "var(--ax-text-neutral)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.8125rem",
              lineHeight: 1.55,
            }}
          >
            <pre style={{ margin: 0, font: "inherit" }}>
              <code>{code}</code>
            </pre>
          </section>
        </>
      )}
    </section>
  );
}

export function SurveyCodePreview({
  survey,
  context,
  behavior,
  sourceCode,
  defaultCollapsed,
}: SurveyCodePreviewProps) {
  const currentDocument = isSurveyDocumentV1(survey);
  return (
    <CodePreview
      code={sourceCode ?? buildSurveySource({ survey, context, behavior })}
      title={currentDocument ? "Survey-dokument" : "Legacy-konfigurasjon"}
      badge={currentDocument ? "SurveyDocumentV1" : "Legacy 2.x"}
      note={
        currentDocument
          ? "authoringSchemaVersion beskriver dokumentformatet. Send inn eksempelet for å se den separate transport-payloaden."
          : "Flat questions[] støttes i 2.x for eksisterende integrasjoner, men skal ikke brukes for nye surveyer."
      }
      tone={currentDocument ? "current" : "legacy"}
      defaultCollapsed={defaultCollapsed}
    />
  );
}
