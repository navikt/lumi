import { BodyShort, Detail, Modal, TextField, VStack } from "@navikt/ds-react";
import styles from "./verksted.module.css";

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  surveyId: string;
  team: string;
  onChangeSurveyId: (surveyId: string) => void;
}

export function SettingsModal({
  open,
  onClose,
  surveyId,
  team,
  onChangeSurveyId,
}: SettingsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      header={{ heading: "Innstillinger for utkastet", closeButton: true }}
      width="small"
    >
      <Modal.Body>
        <VStack gap="space-20">
          <TextField
            label="Foreslått survey-ID"
            description="Identiteten utvikleren tar stilling til i kode. Endring her endrer ikke noe som allerede er delt."
            value={surveyId}
            error={surveyId.trim() ? undefined : "Survey-ID er påkrevd"}
            onChange={(event) => onChangeSurveyId(event.target.value)}
          />
          <div>
            <Detail as="p" className={styles.eyebrow}>
              TEAM
            </Detail>
            <BodyShort>{team}</BodyShort>
            <BodyShort size="small" textColor="subtle">
              Utkastet er delt med alle i teamet via prosjektlenken.
            </BodyShort>
          </div>
        </VStack>
      </Modal.Body>
    </Modal>
  );
}
