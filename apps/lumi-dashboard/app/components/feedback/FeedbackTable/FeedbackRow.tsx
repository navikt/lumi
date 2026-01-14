import { ChevronDownIcon, ChevronUpIcon, TrashIcon } from "@navikt/aksel-icons";
import { ShieldLockIcon } from "@navikt/aksel-icons";
import {
  BodyShort,
  Button,
  CopyButton,
  Detail,
  HStack,
  Table,
  Tag,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import dayjs from "dayjs";
import type { FeedbackDto } from "~/types/api";
import styles from "./styles.module.css";
import {
  deviceToIcon,
  getAllRatings,
  getFeedbackPreview,
  getMainTextPreview,
  ratingToEmoji,
} from "./utils";

interface FeedbackRowProps {
  feedback: FeedbackDto;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

/**
 * A single row in the feedback table showing compact summary.
 * Can be expanded to show full details.
 */
export function FeedbackRow({
  feedback,
  isExpanded,
  onToggleExpand,
  onDelete,
  isDeleting,
}: FeedbackRowProps) {
  const ratings = getAllRatings(feedback);
  const preview = getFeedbackPreview(feedback);
  const copyText = getMainTextPreview(feedback) || "";

  return (
    <Table.Row onClick={onToggleExpand} style={{ cursor: "pointer" }}>
      {/* Expand/Collapse Button */}
      <Table.DataCell>
        <Button
          variant="tertiary"
          size="xsmall"
          aria-label={isExpanded ? "Minimer rad" : "Utvid rad"}
          icon={
            isExpanded ? (
              <ChevronUpIcon aria-hidden />
            ) : (
              <ChevronDownIcon aria-hidden />
            )
          }
        />
      </Table.DataCell>

      {/* Date */}
      <Table.DataCell>
        <Tooltip
          content={dayjs(feedback.submittedAt).format("YYYY-MM-DD HH:mm:ss")}
        >
          <BodyShort size="small">
            {dayjs(feedback.submittedAt).format("DD.MM.YY")}
          </BodyShort>
        </Tooltip>
      </Table.DataCell>

      {/* Feedback Content */}
      <Table.DataCell>
        <VStack gap="space-4">
          {/* Rating emojis and preview */}
          <HStack gap="space-8" align="center" wrap>
            {ratings.map((r) => (
              <Tooltip key={r.label} content={r.label}>
                <span className={styles.ratingEmoji}>
                  {ratingToEmoji(r.rating)}
                </span>
              </Tooltip>
            ))}
            {preview && <FeedbackPreviewText preview={preview} />}
          </HStack>

          {/* Metadata row: device, survey, tags */}
          <HStack gap="space-8" align="center">
            {feedback.context?.deviceType && (
              <Tooltip
                content={`${feedback.context.deviceType}${feedback.context.viewportWidth ? ` (${feedback.context.viewportWidth}px)` : ""}`}
              >
                <span style={{ fontSize: "0.875rem" }}>
                  {deviceToIcon(feedback.context.deviceType)}
                </span>
              </Tooltip>
            )}
            <Detail textColor="subtle">{feedback.surveyId}</Detail>
            <TagsPreview tags={feedback.tags} />
            {feedback.sensitiveDataRedacted && (
              <Tooltip content="Sensitiv data har blitt fjernet">
                <Tag variant="warning" size="small">
                  <ShieldLockIcon aria-hidden /> Redigert
                </Tag>
              </Tooltip>
            )}
          </HStack>
        </VStack>
      </Table.DataCell>

      {/* App */}
      <Table.DataCell>
        <BodyShort size="small">{feedback.app}</BodyShort>
      </Table.DataCell>

      {/* Actions */}
      <Table.DataCell>
        <HStack gap="space-4">
          <CopyButton copyText={copyText} size="xsmall" variant="neutral" />
          <Tooltip content="Slett denne tilbakemeldingen">
            <Button
              variant="tertiary-neutral"
              size="xsmall"
              aria-label="Slett tilbakemelding"
              icon={<TrashIcon aria-hidden />}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              loading={isDeleting}
            />
          </Tooltip>
        </HStack>
      </Table.DataCell>
    </Table.Row>
  );
}

/**
 * Displays feedback preview text with optional subtitle.
 */
function FeedbackPreviewText({
  preview,
}: { preview: { text: string; subText?: string } }) {
  return (
    <VStack gap="0">
      <BodyShort truncate className={styles.previewText}>
        {preview.text}
      </BodyShort>
      {preview.subText && (
        <BodyShort truncate className={styles.previewSubText}>
          {preview.subText}
        </BodyShort>
      )}
    </VStack>
  );
}

/**
 * Shows up to 2 tags with a "+N" indicator for more.
 */
function TagsPreview({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <HStack gap="space-4" wrap>
      {tags.slice(0, 2).map((tag) => (
        <Tag key={tag} variant="neutral" size="small">
          {tag}
        </Tag>
      ))}
      {tags.length > 2 && (
        <Detail textColor="subtle">+{tags.length - 2}</Detail>
      )}
    </HStack>
  );
}
