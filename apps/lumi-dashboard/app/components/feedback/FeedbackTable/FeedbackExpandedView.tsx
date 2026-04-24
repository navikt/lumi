import { TagIcon } from "@navikt/aksel-icons";
import { Box, Detail, HStack, Table, VStack } from "@navikt/ds-react";
import type { FeedbackDto } from "~/types/api";
import { TagEditor } from "../TagEditor";
import {
  ContextGrid,
  ExpandedSection,
  MetadataGrid,
} from "./FeedbackDetailParts";
import styles from "./styles.module.css";
import { TimelineView } from "./TimelineView";

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
