import { TagIcon } from "@navikt/aksel-icons";
import { Box, Detail, HStack, Label, Table, VStack } from "@navikt/ds-react";
import type { FeedbackDto } from "~/types/api";
import { TagEditor } from "../TagEditor";
import { TimelineView } from "./TimelineView";
import styles from "./styles.module.css";
import { deviceToIcon, formatMetadataKey, formatMetadataValue } from "./utils";

interface FeedbackExpandedViewProps {
  feedback: FeedbackDto;
}

/**
 * Expanded view shown when a feedback row is clicked.
 * Displays full answers, context, metadata, and tags.
 */
export function FeedbackExpandedView({ feedback }: FeedbackExpandedViewProps) {
  return (
    <Table.Row className={styles.expandedRow}>
      <Table.DataCell colSpan={5} className={styles.expandedCell}>
        <Box.New
          padding="space-20"
          background="neutral-soft"
          borderRadius="medium"
        >
          <VStack gap="space-20">
            {/* Answers Timeline */}
            <ExpandedSection label={`Svar(${feedback.answers.length})`}>
              <TimelineView answers={feedback.answers} styles={styles} />
            </ExpandedSection>

            {/* Tags Editor */}
            <ExpandedSection
              label="Tags"
              icon={<TagIcon fontSize="1rem" aria-hidden />}
            >
              <TagEditor id={feedback.id} currentTags={feedback.tags || []} />
            </ExpandedSection>

            {/* Context Info */}
            {feedback.context && (
              <ExpandedSection label="Kontekst">
                <ContextGrid context={feedback.context} />
              </ExpandedSection>
            )}

            {/* Custom Metadata */}
            {feedback.metadata && Object.keys(feedback.metadata).length > 0 && (
              <ExpandedSection label="📋 Metadata">
                <MetadataGrid metadata={feedback.metadata} />
              </ExpandedSection>
            )}

            {/* IDs Footer */}
            <div className={styles.metadata}>
              <Detail textColor="subtle">ID: {feedback.id}</Detail>
              <Detail textColor="subtle">Survey: {feedback.surveyId}</Detail>
              {feedback.surveyVersion && (
                <Detail textColor="subtle">v{feedback.surveyVersion}</Detail>
              )}
            </div>
          </VStack>
        </Box.New>
      </Table.DataCell>
    </Table.Row>
  );
}

/**
 * Reusable section wrapper with label.
 */
function ExpandedSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.expandedSection}>
      <Label size="small" className={styles.expandedSectionLabel}>
        {icon ? (
          <HStack gap="space-4" align="center">
            {icon}
            {label}
          </HStack>
        ) : (
          label
        )}
      </Label>
      {children}
    </div>
  );
}

/**
 * Displays submission context (pathname, device, viewport).
 */
function ContextGrid({
  context,
}: { context: NonNullable<FeedbackDto["context"]> }) {
  return (
    <div className={styles.contextGrid}>
      {context.pathname && (
        <ContextItem icon="📍" label="Side" value={context.pathname} />
      )}
      {context.deviceType && (
        <ContextItem
          icon={deviceToIcon(context.deviceType)}
          label="Enhet"
          value={context.deviceType}
        />
      )}
      {(context.viewportWidth || context.viewportHeight) && (
        <ContextItem
          icon="🖼️"
          label="Skjermstørrelse"
          value={`${context.viewportWidth || "?"}×${context.viewportHeight || "?"} `}
        />
      )}
    </div>
  );
}

/**
 * Single item in the context grid.
 */
function ContextItem({
  icon,
  label,
  value,
}: { icon: string; label: string; value: string }) {
  return (
    <div className={styles.contextItem}>
      <span className={styles.contextIcon}>{icon}</span>
      <div className={styles.contextContent}>
        <span className={styles.contextLabel}>{label}</span>
        <span className={styles.contextValue}>{value}</span>
      </div>
    </div>
  );
}

/**
 * Displays custom metadata key-value pairs.
 */
function MetadataGrid({ metadata }: { metadata: Record<string, string> }) {
  return (
    <div className={styles.contextGrid}>
      {Object.entries(metadata).map(([key, value]) => (
        <div key={key} className={styles.contextItem}>
          <div className={styles.contextContent}>
            <span className={styles.contextLabel}>
              {formatMetadataKey(key)}
            </span>
            <span className={styles.contextValue}>
              {formatMetadataValue(value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
