import { Alert, BodyShort, Heading, VStack } from "@navikt/ds-react";
import type { PrivacyInfo } from "~/types/api";

interface PrivacyMaskedNoticeProps {
  privacy: PrivacyInfo;
}

/**
 * Notice shown when data is masked due to privacy threshold.
 * Used when response count is too low to safely show aggregated statistics.
 */
export function PrivacyMaskedNotice({ privacy }: PrivacyMaskedNoticeProps) {
  return (
    <Alert variant="info" style={{ marginBlock: "1rem" }}>
      <VStack gap="space-4">
        <Heading size="xsmall">For få svar til å vise statistikk</Heading>
        <BodyShort size="small">
          For å beskytte personvernet til de som har svart, kreves det minst{" "}
          {privacy.threshold} svar før statistikk vises. Akkurat nå har denne
          undersøkelsen for få svar.
        </BodyShort>
      </VStack>
    </Alert>
  );
}
