import { TagIcon } from "@navikt/aksel-icons";
import {
  BodyShort,
  Box,
  Detail,
  HGrid,
  HStack,
  Table,
  VStack,
} from "@navikt/ds-react";
import type { FeedbackDto } from "~/types/api";
import { TagEditor } from "../TagEditor";
import styles from "./styles.module.css";
import { TimelineView } from "./TimelineView";
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
        <Box padding="space-20" background="neutral-soft" borderRadius="8">
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

            {/* Segment (context.tags) */}
            {feedback.context?.tags &&
              Object.keys(feedback.context.tags).length > 0 && (
                <ExpandedSection label="🏷️ Segment">
                  <MetadataGrid metadata={feedback.context.tags} />
                </ExpandedSection>
              )}

            {/* Custom Metadata */}
            {feedback.metadata && Object.keys(feedback.metadata).length > 0 && (
              <ExpandedSection label="📋 Metadata">
                <MetadataGrid metadata={feedback.metadata} />
              </ExpandedSection>
            )}

            {/* IDs Footer */}
            <HStack className={styles.metadata} gap="space-16" wrap>
              <Detail textColor="subtle">ID: {feedback.id}</Detail>
              <Detail textColor="subtle">Survey: {feedback.surveyId}</Detail>
              {feedback.surveyVersion && (
                <Detail textColor="subtle">v{feedback.surveyVersion}</Detail>
              )}
            </HStack>
          </VStack>
        </Box>
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
    <VStack gap="space-8">
      {icon ? (
        <HStack gap="space-4" align="center">
          {icon}
          <Detail className={styles.expandedSectionLabel}>{label}</Detail>
        </HStack>
      ) : (
        <Detail className={styles.expandedSectionLabel}>{label}</Detail>
      )}
      {children}
    </VStack>
  );
}

/**
 * Displays submission context (pathname, device, viewport).
 */
function ContextGrid({
  context,
}: {
  context: NonNullable<FeedbackDto["context"]>;
}) {
  return (
    <HGrid columns="repeat(auto-fit, minmax(180px, 1fr))" gap="space-12">
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
          label="Viewport"
          value={`${context.viewportWidth || "?"}×${context.viewportHeight || "?"} `}
        />
      )}
    </HGrid>
  );
}

/**
 * Single item in the context grid.
 */
function ContextItem({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.contextItem}>
      <span className={styles.contextIcon}>{icon}</span>
      <VStack gap="space-2">
        <Detail className={styles.contextLabel} textColor="subtle">
          {label}
        </Detail>
        <BodyShort className={styles.contextValue}>{value}</BodyShort>
      </VStack>
    </div>
  );
}

/**
 * Displays custom metadata key-value pairs.
 */
function MetadataGrid({ metadata }: { metadata: Record<string, string> }) {
  return (
    <HGrid columns="repeat(auto-fit, minmax(180px, 1fr))" gap="space-12">
      {Object.entries(metadata).map(([key, value]) => (
        <div key={key} className={styles.contextItem}>
          <VStack gap="space-2">
            <Detail className={styles.contextLabel} textColor="subtle">
              {formatMetadataKey(key)}
            </Detail>
            <BodyShort className={styles.contextValue}>
              {formatMetadataValue(value)}
            </BodyShort>
          </VStack>
        </div>
      ))}
    </HGrid>
  );
}
