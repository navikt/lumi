import {
  CalendarIcon,
  ChatIcon,
  StarIcon,
  TasklistIcon,
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
import { COLORS, ratingToEmoji } from "./utils";

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
        <VStack gap="space-8" style={{ flex: 1 }}>
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

// Render a single answer based on its type
export function RenderAnswer({
  answer,
  styles,
}: { answer: Answer; styles: Record<string, string> }) {
  switch (answer.fieldType) {
    case "RATING": {
      const ratingValue =
        answer.value.type === "rating" ? answer.value.rating : 0;
      return (
        <AnswerCardLayout
          styles={styles}
          className="answer-card--rating"
          icon={
            <Tooltip content="Vurdering (1-5)">
              <StarIcon
                fontSize="1.5rem"
                style={{ color: COLORS.iconWarning }}
              />
            </Tooltip>
          }
          label={answer.question.label}
          description={answer.question.description}
        >
          <HStack align="center" gap="space-8">
            <div className={styles.ratingBar}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`${styles.ratingDot} ${n <= ratingValue ? styles.ratingDotFilled : ""}`}
                  data-rating={n}
                >
                  {ratingToEmoji(n)}
                </span>
              ))}
            </div>
            <span className={styles.ratingScore}>{ratingValue}/5</span>
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
              <ChatIcon fontSize="1.5rem" style={{ color: COLORS.iconInfo }} />
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
      const options = answer.question.options || [];

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
          {options.length > 0 ? (
            <div className={styles.choiceOptions}>
              {options.map((opt) => (
                <span
                  key={opt.id}
                  className={`${styles.choiceOption} ${selectedIds.includes(opt.id) ? styles.choiceOptionSelected : ""}`}
                >
                  {selectedIds.includes(opt.id) ? "✓ " : ""}
                  {opt.label}
                </span>
              ))}
            </div>
          ) : (
            <BodyShort>{selectedIds.join(", ") || "Ingen valgt"}</BodyShort>
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
