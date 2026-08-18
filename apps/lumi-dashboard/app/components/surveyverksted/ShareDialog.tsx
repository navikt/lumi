import { CheckmarkCircleIcon, LinkIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Button,
  CopyButton,
  Detail,
  HStack,
  Loader,
  Modal,
  VStack,
} from "@navikt/ds-react";
import { Link } from "@tanstack/react-router";
import type { SurveyAuthoringRevisionSummary } from "~/types/surveyAuthoring";
import styles from "./verksted.module.css";

export type ShareStatus =
  | "ready"
  | "saving"
  | "invalid"
  | "conflict"
  | "missing"
  | "save-error";

export interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  status: ShareStatus;
  validationMessage: string | null;
  validationLocation: { pageNumber: number; questionNumber: number } | null;
  nextRevisionNumber: number | null;
  stats: { pages: number; questions: number };
  revisions: SurveyAuthoringRevisionSummary[];
  team: string;
  freezing: boolean;
  freezeError: string | null;
  onFreeze: () => void;
  onOpenSettings: () => void;
  saveErrorMessage: string | null;
  onRetrySave: () => void;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function revisionUrl(revisionId: string, team: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/surveyverksted/revisions/${revisionId}?team=${encodeURIComponent(team)}`;
}

/**
 * The "create release" moment: freezing the draft into an immutable,
 * shareable revision. Publishes nothing — the developer takes it into code.
 */
export function ShareDialog({
  open,
  onClose,
  status,
  validationMessage,
  validationLocation,
  nextRevisionNumber,
  stats,
  revisions,
  team,
  freezing,
  freezeError,
  onFreeze,
  onOpenSettings,
  saveErrorMessage,
  onRetrySave,
}: ShareDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      header={{ heading: "Del med utvikler", closeButton: true }}
      width={480}
    >
      <Modal.Body>
        <VStack gap="space-20">
          {status === "conflict" ? (
            <Alert variant="error">
              Utkastet er endret et annet sted, for eksempel i en annen fane.
              Last siden på nytt før du deler.
            </Alert>
          ) : status === "save-error" ? (
            <Alert variant="error">
              <BodyShort spacing>
                Utkastet får ikke lagret
                {saveErrorMessage ? `: ${saveErrorMessage}` : ""}. Deling krever
                at endringene er lagret.
              </BodyShort>
              <Button
                type="button"
                variant="secondary-neutral"
                size="small"
                onClick={onRetrySave}
              >
                Prøv å lagre igjen
              </Button>
            </Alert>
          ) : status === "missing" ? (
            <Alert variant="warning">
              <BodyShort spacing>
                Utkastet mangler navn eller survey-ID, så det kan ikke lagres
                eller deles ennå.
              </BodyShort>
              <Button
                type="button"
                variant="secondary-neutral"
                size="small"
                onClick={onOpenSettings}
              >
                Åpne innstillinger
              </Button>
            </Alert>
          ) : status === "invalid" ? (
            <Alert variant="warning">
              <BodyShort weight="semibold" spacing>
                Utkastet har en feil som må rettes først
                {validationLocation
                  ? ` (side ${validationLocation.pageNumber}, spørsmål ${validationLocation.questionNumber})`
                  : ""}
                .
              </BodyShort>
              <BodyShort size="small">{validationMessage}</BodyShort>
            </Alert>
          ) : status === "saving" ? (
            <HStack gap="space-8" align="center">
              <Loader size="small" title="Lagrer utkastet" />
              <BodyShort size="small">
                Lagrer utkastet … Delingen fortsetter når alt er lagret.
              </BodyShort>
            </HStack>
          ) : (
            <div className={styles.shareReady}>
              <CheckmarkCircleIcon aria-hidden />
              <div>
                <BodyShort weight="semibold">
                  {nextRevisionNumber === null
                    ? "Klar til å dele en ny versjon"
                    : `Klar til å dele versjon ${nextRevisionNumber}`}
                </BodyShort>
                <BodyShort size="small" textColor="subtle">
                  {stats.pages} {stats.pages === 1 ? "side" : "sider"} ·{" "}
                  {stats.questions} spørsmål · klar til bruk
                </BodyShort>
              </div>
            </div>
          )}

          <BodyShort size="small" textColor="subtle">
            Du får en lenke som viser akkurat denne versjonen. Bare teamet har
            tilgang. Lim lenken inn i GitHub-saken eller oppgaven. Surveyen
            publiseres ikke — utvikleren legger den inn i appen.
          </BodyShort>

          {freezeError ? <Alert variant="error">{freezeError}</Alert> : null}

          {revisions.length > 0 ? (
            <div>
              <Detail as="p" className={styles.eyebrow}>
                DELTE VERSJONER
              </Detail>
              <ol className={styles.revisionList}>
                {revisions.map((revision) => (
                  <li key={revision.id} className={styles.revisionRow}>
                    <Link
                      to="/surveyverksted/revisions/$revisionId"
                      params={{ revisionId: revision.id }}
                      search={{ team }}
                      className={styles.revisionLink}
                    >
                      <span className={styles.revisionNumber}>
                        {String(revision.revisionNumber).padStart(2, "0")}
                      </span>
                      <span>
                        <BodyShort as="span" size="small" weight="semibold">
                          Versjon {revision.revisionNumber}
                        </BodyShort>
                        <Detail as="span" className={styles.revisionMeta}>
                          {formatTimestamp(revision.createdAt)}
                        </Detail>
                      </span>
                    </Link>
                    <CopyButton
                      size="xsmall"
                      copyText={revisionUrl(revision.id, team)}
                      title={`Kopier lenken til versjon ${revision.revisionNumber}`}
                      icon={<LinkIcon aria-hidden />}
                    />
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </VStack>
      </Modal.Body>
      <Modal.Footer>
        <Button
          type="button"
          disabled={status !== "ready"}
          loading={freezing}
          onClick={onFreeze}
        >
          {nextRevisionNumber === null
            ? "Del en ny versjon"
            : `Del versjon ${nextRevisionNumber}`}
        </Button>
        <Button type="button" variant="tertiary" onClick={onClose}>
          Avbryt
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
