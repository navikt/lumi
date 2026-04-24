import {
  ChevronDownIcon,
  ChevronUpIcon,
  ShieldLockIcon,
  TrashIcon,
} from "@navikt/aksel-icons";
import {
  BodyShort,
  Button,
  CopyButton,
  Detail,
  HGrid,
  HStack,
  Tag,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import dayjs from "dayjs";
import { DashboardCard } from "~/components/dashboard";
import { useBreakpoint } from "~/hooks/useBreakpoint";
import type { FeedbackDto } from "~/types/api";
import { RenderAnswer } from "./AnswerRenderer";
import {
  ContextItem,
  ExpandedSection,
  MetadataGrid,
} from "./FeedbackDetailParts";
import { RatingBadge } from "./RatingBadge";
import styles from "./styles.module.css";
import { TimelineView } from "./TimelineView";
import {
  deviceToIcon,
  getAllRatings,
  getFeedbackPreview,
  getMainTextPreview,
} from "./utils";

interface FeedbackCardProps {
  feedback: FeedbackDto;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

/**
 * Mobile-optimized card view for a feedback item.
 * Shows compact summary with tap-to-expand functionality.
 * Expanded view uses similar styling to desktop for visual consistency.
 */
export function FeedbackCard({
  feedback,
  isExpanded,
  onToggleExpand,
  onDelete,
  isDeleting,
}: FeedbackCardProps) {
  const ratings = getAllRatings(feedback);
  const preview = getFeedbackPreview(feedback);
  const copyText = getMainTextPreview(feedback) || "";

  // Use timeline view only on larger mobiles (sm breakpoint = 480px+)
  // On very small screens (xs, below 480px), use simple cards to save space
  const { isBelow } = useBreakpoint();
  const showTimeline = !isBelow("sm");

  return (
    <DashboardCard
      padding="space-16"
      className={`${styles.cardInteractive} ${isExpanded ? styles.cardExpanded : ""}`}
      onClick={onToggleExpand}
    >
      <VStack gap="space-12">
        {/* Header row: Date, Device, App */}
        <HStack justify="space-between" align="center" wrap>
          <HStack gap="space-8" align="center">
            <Tooltip
              content={dayjs(feedback.submittedAt).format(
                "YYYY-MM-DD HH:mm:ss",
              )}
            >
              <Detail textColor="subtle">
                {dayjs(feedback.submittedAt).format("DD.MM.YY HH:mm")}
              </Detail>
            </Tooltip>
            {feedback.context?.deviceType && (
              <span className={styles.deviceIcon}>
                {deviceToIcon(feedback.context.deviceType)}
              </span>
            )}
          </HStack>
          <Tag data-color="neutral" variant="outline" size="small">
            {feedback.app}
          </Tag>
        </HStack>

        {/* Rating display */}
        {ratings.length > 0 && (
          <HStack gap="space-8" align="center">
            {ratings.map((r) => (
              <Tooltip key={r.label} content={r.label}>
                <RatingBadge
                  rating={r.rating}
                  variant={r.variant}
                  scale={r.scale}
                />
              </Tooltip>
            ))}
          </HStack>
        )}

        {/* Preview text (collapsed) */}
        {!isExpanded && preview && (
          <VStack gap="space-4">
            <BodyShort truncate className={styles.previewPrimary}>
              {preview.text}
            </BodyShort>
            {preview.subText && (
              <BodyShort
                truncate
                size="small"
                textColor="subtle"
                className={styles.previewSecondary}
              >
                {preview.subText}
              </BodyShort>
            )}
          </VStack>
        )}

        {/* ===== EXPANDED CONTENT ===== */}
        {isExpanded && (
          <VStack gap="space-16">
            {/* Section: Svar (Answers) */}
            {feedback.answers && feedback.answers.length > 0 && (
              <ExpandedSection label={`Svar (${feedback.answers.length})`}>
                {/* Timeline on larger screens, simple cards on small screens */}
                {showTimeline ? (
                  <TimelineView answers={feedback.answers} styles={styles} />
                ) : (
                  <VStack gap="space-8">
                    {feedback.answers.map((answer) => (
                      <RenderAnswer
                        key={answer.fieldId}
                        answer={answer}
                        styles={styles}
                      />
                    ))}
                  </VStack>
                )}
              </ExpandedSection>
            )}

            {/* Section: Kontekst (Context) */}
            <ExpandedSection label="Kontekst">
              <HGrid
                columns="repeat(auto-fit, minmax(180px, 1fr))"
                gap="space-12"
              >
                <ContextItem
                  icon="📋"
                  label="Survey"
                  value={feedback.surveyId}
                />
                <ContextItem
                  icon="🕐"
                  label="Tidspunkt"
                  value={dayjs(feedback.submittedAt).format("DD. MMM, HH:mm")}
                />
                {feedback.context?.pathname && (
                  <ContextItem
                    icon="📍"
                    label="Side"
                    value={feedback.context.pathname}
                  />
                )}
                {feedback.context?.deviceType && (
                  <ContextItem
                    icon={deviceToIcon(feedback.context.deviceType)}
                    label="Enhet"
                    value={
                      feedback.context.deviceType +
                      (feedback.context.viewportWidth
                        ? ` (viewport ${feedback.context.viewportWidth}×${feedback.context.viewportHeight})`
                        : "")
                    }
                  />
                )}
              </HGrid>
            </ExpandedSection>

            {/* Section: Segment (context.tags) */}
            {feedback.context?.tags &&
              Object.keys(feedback.context.tags).length > 0 && (
                <ExpandedSection label="🏷️ Segment">
                  <MetadataGrid metadata={feedback.context.tags} />
                </ExpandedSection>
              )}

            {/* Section: Tags */}
            {feedback.tags && feedback.tags.length > 0 && (
              <ExpandedSection label="🏷️ Tagger">
                <HStack gap="space-8" wrap>
                  {feedback.tags.map((tag) => (
                    <Tag
                      data-color="neutral"
                      key={tag}
                      variant="outline"
                      size="small"
                    >
                      {tag}
                    </Tag>
                  ))}
                </HStack>
              </ExpandedSection>
            )}

            {/* Section: Metadata */}
            {feedback.metadata && Object.keys(feedback.metadata).length > 0 && (
              <ExpandedSection label="📋 Metadata">
                <MetadataGrid metadata={feedback.metadata} />
              </ExpandedSection>
            )}

            {/* Sensitive data warning */}
            {feedback.sensitiveDataRedacted && (
              <Tag data-color="warning" variant="outline" size="small">
                <ShieldLockIcon aria-hidden /> Sensitive data er redigert bort
              </Tag>
            )}

            {/* IDs Footer */}
            <HStack className={styles.metadata} gap="space-16" wrap>
              <Detail textColor="subtle">ID: {feedback.id}</Detail>
              {feedback.surveyVersion && (
                <Detail textColor="subtle">v{feedback.surveyVersion}</Detail>
              )}
            </HStack>
          </VStack>
        )}

        {/* Collapsed: Survey ID and tags preview */}
        {!isExpanded && (
          <HStack gap="space-8" align="center" wrap>
            <Detail textColor="subtle">{feedback.surveyId}</Detail>
            {feedback.tags && feedback.tags.length > 0 && (
              <>
                {feedback.tags.slice(0, 2).map((tag) => (
                  <Tag
                    data-color="neutral"
                    key={tag}
                    variant="outline"
                    size="small"
                  >
                    {tag}
                  </Tag>
                ))}
                {feedback.tags.length > 2 && (
                  <Detail textColor="subtle">
                    +{feedback.tags.length - 2}
                  </Detail>
                )}
              </>
            )}
            {feedback.sensitiveDataRedacted && (
              <Tag data-color="warning" variant="outline" size="small">
                <ShieldLockIcon aria-hidden /> Redigert
              </Tag>
            )}
          </HStack>
        )}

        {/* Action row */}
        <HStack justify="space-between" align="center">
          <Button
            variant="tertiary"
            size="xsmall"
            icon={
              isExpanded ? (
                <ChevronUpIcon aria-hidden />
              ) : (
                <ChevronDownIcon aria-hidden />
              )
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {isExpanded ? "Skjul" : "Vis mer"}
          </Button>

          <HStack gap="space-4">
            <CopyButton copyText={copyText} size="xsmall" variant="neutral" />
            <Tooltip content="Slett denne tilbakemeldingen">
              <Button
                data-color="neutral"
                variant="tertiary"
                size="xsmall"
                icon={<TrashIcon aria-hidden />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                loading={isDeleting}
              />
            </Tooltip>
          </HStack>
        </HStack>
      </VStack>
    </DashboardCard>
  );
}
