import {
  CalendarIcon,
  ChatIcon,
  StarIcon,
  TasklistIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "@navikt/aksel-icons";
import {
  BodyShort,
  Detail,
  HStack,
  Label,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import type { ReactNode } from "react";
import type { Answer } from "~/types/api";
import {
  inferRatingVariantFromAnswer,
  normalizeRatingVariant,
  type RatingVariant,
} from "~/utils/ratingDisplay";
import { ratingToEmoji } from "./utils";

interface AnswerCardLayoutProps {
  icon: ReactNode;
  label: string;
  description?: string;
  children: ReactNode;
  styles: Record<string, string>;
  className?: string; // For passing custom classes like "answer-card--rating"
}

function AnswerCardLayout({
  icon,
  label,
  description,
  children,
  styles,
  className = "",
}: AnswerCardLayoutProps) {
  return (
    <div className={`${styles.answerCard} ${className}`}>
      <HStack gap="space-16" align="start">
        <div className={styles.answerIcon}>{icon}</div>
        <VStack gap="space-8" className={styles.answerContentGrow}>
          <div>
            <Label size="small">{label}</Label>
            {description && <Detail textColor="subtle">{description}</Detail>}
          </div>
          <div className={styles.answerContent}>{children}</div>
        </VStack>
      </HStack>
    </div>
  );
}

function renderChoiceFallback(selectedValues: string[]) {
  const fallbackText = selectedValues.filter(Boolean).join(", ");

  return <BodyShort>{fallbackText || "Ingen valgt"}</BodyShort>;
}

// Render a single answer based on its type
export function RenderAnswer({
  answer,
  styles,
}: {
  answer: Answer;
  styles: Record<string, string>;
}) {
  switch (answer.fieldType) {
    case "RATING": {
      const ratingValue =
        answer.value.type === "rating" ? answer.value.rating : 0;
      const ratingVariantFromPayload =
        answer.value.type === "rating"
          ? normalizeRatingVariant(
              (answer.value as { ratingVariant?: unknown }).ratingVariant,
            )
          : undefined;

      const ratingScaleFromPayload =
        answer.value.type === "rating"
          ? (answer.value as { ratingScale?: unknown }).ratingScale
          : undefined;

      const ratingVariant: RatingVariant = inferRatingVariantFromAnswer({
        rating: ratingValue,
        ratingVariant: ratingVariantFromPayload,
        ratingScale: ratingScaleFromPayload,
      });

      const ratingScale =
        typeof ratingScaleFromPayload === "number"
          ? ratingScaleFromPayload
          : ratingVariant === "nps"
            ? 11
            : ratingVariant === "thumbs"
              ? 2
              : 5;

      // Variant-specific rendering
      if (ratingVariant === "thumbs") {
        const isPositive = ratingValue >= 2;
        return (
          <AnswerCardLayout
            styles={styles}
            className="answer-card--rating"
            icon={
              <Tooltip content="Tommel opp/ned">
                {isPositive ? (
                  <ThumbUpIcon
                    fontSize="1.5rem"
                    className={styles.iconThumbPositive}
                  />
                ) : (
                  <ThumbDownIcon
                    fontSize="1.5rem"
                    className={styles.iconThumbNegative}
                  />
                )}
              </Tooltip>
            }
            label={answer.question.label}
            description={answer.question.description}
          >
            <HStack align="center" gap="space-8">
              <span
                className={`${styles.ratingBadge} ${isPositive ? styles.ratingBadgeThumbPositive : styles.ratingBadgeThumbNegative}`}
              >
                {isPositive ? "👍 Ja" : "👎 Nei"}
              </span>
            </HStack>
          </AnswerCardLayout>
        );
      }

      if (ratingVariant === "nps") {
        const category =
          ratingValue >= 9
            ? "promoter"
            : ratingValue >= 7
              ? "passive"
              : "detractor";
        const categoryColors = {
          promoter: styles.ratingBadgePromoter,
          passive: styles.ratingBadgePassive,
          detractor: styles.ratingBadgeDetractor,
        };
        const badgeClass = categoryColors[category];

        return (
          <AnswerCardLayout
            styles={styles}
            className="answer-card--rating"
            icon={
              <Tooltip content="NPS (0-10)">
                <StarIcon fontSize="1.5rem" className={styles.iconWarning} />
              </Tooltip>
            }
            label={answer.question.label}
            description={answer.question.description}
          >
            <HStack align="center" gap="space-8">
              <span className={`${styles.ratingBadge} ${badgeClass}`}>
                {ratingValue}/10
              </span>
            </HStack>
          </AnswerCardLayout>
        );
      }

      if (ratingVariant === "stars") {
        return (
          <AnswerCardLayout
            styles={styles}
            className="answer-card--rating"
            icon={
              <Tooltip content={`Stjerner (1-${ratingScale})`}>
                <StarIcon fontSize="1.5rem" className={styles.iconWarning} />
              </Tooltip>
            }
            label={answer.question.label}
            description={answer.question.description}
          >
            <HStack align="center" gap="space-8">
              <span className={styles.starsVisual}>
                {"⭐".repeat(ratingValue)}
                {"☆".repeat(ratingScale - ratingValue)}
              </span>
              <span className={styles.ratingScore}>
                {ratingValue}/{ratingScale}
              </span>
            </HStack>
          </AnswerCardLayout>
        );
      }

      // Default: emoji variant
      return (
        <AnswerCardLayout
          styles={styles}
          className="answer-card--rating"
          icon={
            <Tooltip content={`Vurdering (1-${ratingScale})`}>
              <StarIcon fontSize="1.5rem" className={styles.iconWarning} />
            </Tooltip>
          }
          label={answer.question.label}
          description={answer.question.description}
        >
          <HStack align="center" gap="space-8">
            <div className={styles.ratingBar}>
              {Array.from({ length: ratingScale }, (_, i) => i + 1).map((n) => (
                <span
                  key={n}
                  className={`${styles.ratingDot} ${n <= ratingValue ? styles.ratingDotFilled : ""}`}
                  data-rating={n}
                >
                  {ratingToEmoji(n)}
                </span>
              ))}
            </div>
            <span className={styles.ratingScore}>
              {ratingValue}/{ratingScale}
            </span>
          </HStack>
        </AnswerCardLayout>
      );
    }
    case "TEXT":
      return (
        <AnswerCardLayout
          styles={styles}
          className="answer-card--text"
          icon={
            <Tooltip content="Fritekst">
              <ChatIcon fontSize="1.5rem" className={styles.iconInfo} />
            </Tooltip>
          }
          label={answer.question.label}
          description={answer.question.description}
        >
          {answer.value.type === "text" && answer.value.text ? (
            <BodyShort>{answer.value.text}</BodyShort>
          ) : (
            <span className={styles.answerEmpty}>Ikke utfylt</span>
          )}
        </AnswerCardLayout>
      );
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE": {
      const selectedIds =
        answer.value.type === "singleChoice"
          ? [answer.value.selectedOptionId]
          : answer.value.type === "multiChoice"
            ? answer.value.selectedOptionIds
            : [];
      const options = answer.question.options ?? [];
      const hasOptions = options.length > 0;

      return (
        <AnswerCardLayout
          styles={styles}
          className="answer-card--choice"
          icon={
            <Tooltip
              content={
                answer.fieldType === "MULTI_CHOICE" ? "Flervalg" : "Enkeltvalg"
              }
            >
              <TasklistIcon fontSize="1.5rem" aria-hidden />
            </Tooltip>
          }
          label={answer.question.label}
          description={answer.question.description}
        >
          {hasOptions ? (
            <div className={styles.choiceOptions}>
              {options.map((opt) => {
                const isSelected = selectedIds.includes(opt.id);
                return (
                  <span
                    key={opt.id}
                    className={
                      isSelected
                        ? styles.choiceOptionSelected
                        : styles.choiceOption
                    }
                  >
                    {isSelected && "✓ "}
                    {opt.label}
                  </span>
                );
              })}
            </div>
          ) : (
            renderChoiceFallback(selectedIds)
          )}
        </AnswerCardLayout>
      );
    }
    case "DATE":
      return (
        <AnswerCardLayout
          styles={styles}
          className="answer-card--date"
          icon={
            <Tooltip content="Dato">
              <CalendarIcon fontSize="1.5rem" aria-hidden />
            </Tooltip>
          }
          label={answer.question.label}
          description={answer.question.description}
        >
          <BodyShort>
            {answer.value.type === "date" ? answer.value.date : "—"}
          </BodyShort>
        </AnswerCardLayout>
      );
    default:
      return null;
  }
}
