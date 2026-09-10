import {
  BranchingIcon,
  CheckmarkCircleIcon,
  ExclamationmarkTriangleFillIcon,
} from "@navikt/aksel-icons";
import { BodyShort, Detail, Modal, Tag } from "@navikt/ds-react";
import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { LiveVisibilityChip } from "./LiveVisibilityChip";
import { questionTypeMeta } from "./questionTypeMeta";
import styles from "./verksted.module.css";

export interface FlowOverviewProps {
  open: boolean;
  onClose: () => void;
  document: SurveyDocumentV1;
  conditionSummaries: ReadonlyMap<string, string>;
  liveVisibility: ReadonlyMap<string, boolean>;
  hasStageAnswers: boolean;
  /** Handoff issues per question, shown as warnings on the rows */
  issuesByQuestion: ReadonlyMap<string, readonly string[]>;
  /** Handoff issues without a question (intro/success) */
  surveyIssues: readonly string[];
  onJump: (pageId: string, questionId: string) => void;
}

/**
 * The whole journey on one surface: every page and question in order, with
 * branch conditions in plain language. Live: rows reflect the answers given
 * in the preview right now, so authors can walk a branch and watch the
 * flow change. Rows jump to the question in the editor.
 */
export function FlowOverview({
  open,
  onClose,
  document,
  conditionSummaries,
  liveVisibility,
  hasStageAnswers,
  issuesByQuestion,
  surveyIssues,
  onJump,
}: FlowOverviewProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="medium"
      header={{ heading: "Flyten", icon: <BranchingIcon aria-hidden /> }}
    >
      <Modal.Body>
        <div className={styles.flowBody}>
          <BodyShort size="small" textColor="subtle">
            {hasStageAnswers
              ? "Vist med svarene som er gitt i forhåndsvisningen nå. Grener uten treff er merket «Skjult nå»."
              : "Svar i forhåndsvisningen, så ser du her hvilke grener som slår til underveis."}
          </BodyShort>

          {[...new Set(surveyIssues)].map((message) => (
            <Detail as="p" key={message} className={styles.flowIssue}>
              <ExclamationmarkTriangleFillIcon aria-hidden />
              {message}
            </Detail>
          ))}

          {document.intro?.title.trim() ? (
            <div className={styles.flowScreen}>
              <Tag variant="neutral" size="xsmall">
                Velkomstside
              </Tag>
              <BodyShort as="span" size="small">
                «{document.intro.title}» — respondenten klikker{" "}
                {document.intro.startLabel?.trim() || "Start"}
              </BodyShort>
            </div>
          ) : null}

          <ol className={styles.flowList}>
            {document.pages.map((page, pageIndex) => {
              const fullyConditional =
                page.questions.length > 0 &&
                page.questions.every(
                  (question) => question.visibleIf !== undefined,
                );
              const skippedNow =
                fullyConditional &&
                page.questions.every(
                  (question) => liveVisibility.get(question.id) === false,
                );
              return (
                <li key={page.id} className={styles.flowPage}>
                  <div className={styles.flowPageHeader}>
                    <Detail as="span" className={styles.eyebrow}>
                      SIDE {pageIndex + 1}
                    </Detail>
                    {page.title?.trim() ? (
                      <BodyShort as="span" size="small" weight="semibold">
                        {page.title}
                      </BodyShort>
                    ) : null}
                    {skippedNow ? (
                      <Tag variant="warning" size="xsmall">
                        Hoppes over nå
                      </Tag>
                    ) : fullyConditional ? (
                      <Tag variant="info" size="xsmall">
                        Betinget side
                      </Tag>
                    ) : null}
                  </div>
                  <ol className={styles.flowQuestions}>
                    {page.questions.map((question, questionIndex) => {
                      const meta = questionTypeMeta(question.type);
                      const summary = conditionSummaries.get(question.id);
                      const live = question.visibleIf
                        ? liveVisibility.get(question.id)
                        : undefined;
                      return (
                        <li key={question.id}>
                          <button
                            type="button"
                            className={styles.flowQuestion}
                            data-hidden-now={live === false || undefined}
                            onClick={() => onJump(page.id, question.id)}
                          >
                            <span className={styles.flowQuestionTop}>
                              <Detail as="span" className={styles.flowNumber}>
                                {pageIndex + 1}.{questionIndex + 1}
                              </Detail>
                              <meta.Icon aria-hidden />
                              <BodyShort
                                as="span"
                                size="small"
                                weight="semibold"
                                className={styles.flowPrompt}
                              >
                                {question.prompt.trim() ||
                                  "Spørsmål uten tekst"}
                              </BodyShort>
                              {live !== undefined ? (
                                <LiveVisibilityChip visible={live} />
                              ) : null}
                            </span>
                            {summary ? (
                              <Detail
                                as="span"
                                className={styles.flowBranchLine}
                              >
                                <span aria-hidden>↳</span>
                                {summary}
                              </Detail>
                            ) : null}
                            {[
                              ...new Set(issuesByQuestion.get(question.id)),
                            ].map((message) => (
                              <Detail
                                as="span"
                                key={message}
                                className={styles.flowIssue}
                              >
                                <ExclamationmarkTriangleFillIcon aria-hidden />
                                {message}
                              </Detail>
                            ))}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ol>

          <div className={styles.flowScreen}>
            <CheckmarkCircleIcon aria-hidden />
            <BodyShort as="span" size="small">
              Send inn →{" "}
              {document.success?.title.trim()
                ? `«${document.success.title}»`
                : "standardbekreftelsen"}
            </BodyShort>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}
