import {
  BodyShort,
  Box,
  CopyButton,
  Detail,
  Heading,
  HGrid,
  VStack,
} from "@navikt/ds-react";
import type { ReactNode } from "react";
import { ExternalLink } from "./ExternalLink";
import {
  BIGQUERY_GUIDE_URL,
  MARKETPLACE_NEW_PRODUCT_URL,
  METABASE_GUIDE_URL,
} from "./format";

function Step({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Box
      as="li"
      background="raised"
      borderWidth="1"
      borderColor="neutral-subtle"
      borderRadius="8"
      padding="space-16"
    >
      <VStack gap="space-8">
        {/* The list already numbers the steps for screen readers. */}
        <Detail aria-hidden>{step}</Detail>
        <Heading level="3" size="small">
          {title}
        </Heading>
        {children}
      </VStack>
    </Box>
  );
}

export function NextSteps({ team }: { team: string }) {
  const productName = `Lumi: svar fra ${team}`;
  return (
    <VStack gap="space-12">
      <Heading level="2" size="medium">
        Neste steg
      </Heading>
      <HGrid
        as="ol"
        // VoiceOver in Safari drops list semantics when list-style is none.
        role="list"
        columns={{ xs: 1, md: 2 }}
        gap="space-12"
        style={{ listStyle: "none", margin: 0, paddingInlineStart: 0 }}
      >
        <Step step="01" title="Del dataene på Datamarkedsplassen">
          <BodyShort size="small">
            Lag et view med bare appene og surveyene du vil dele, og legg det
            til i et dataprodukt på Datamarkedsplassen. Velg at det inneholder
            personopplysninger.
          </BodyShort>
          <BodyShort size="small" as="div">
            Forslag til navn: <strong>{productName}</strong>{" "}
            <CopyButton
              copyText={productName}
              size="xsmall"
              title="Kopier navnet"
              activeText="Kopiert"
            />
          </BodyShort>
          <ExternalLink href={`${BIGQUERY_GUIDE_URL}#datamarkedsplassen`}>
            Slik lager du viewet
          </ExternalLink>
          <ExternalLink href={MARKETPLACE_NEW_PRODUCT_URL}>
            Åpne Datamarkedsplassen
          </ExternalLink>
        </Step>
        <Step step="02" title="Gi tilgang og legg til i Metabase">
          <BodyShort size="small">
            Gi tilgang på Datamarkedsplassen, og velg Legg til i Metabase.
            Metabase gir bare tilgang til personer som har fått tilgang hver for
            seg. Gruppetilgang følger ikke med.
          </BodyShort>
          <ExternalLink href={METABASE_GUIDE_URL}>
            Slik fungerer tilgang i Metabase
          </ExternalLink>
        </Step>
        <Step step="03" title="Lag grafer og dashboard i Metabase">
          <BodyShort size="small">
            Tabellen svar har spørsmålstekst og svartekst på hver rad, så den
            fungerer i Metabase uten SQL. Lumi-dokumentasjonen har ferdige
            spørringer for fordeling, snitt og NPS.
          </BodyShort>
          <ExternalLink href={`${BIGQUERY_GUIDE_URL}#sporringer`}>
            Se spørringene
          </ExternalLink>
        </Step>
        <Step step="04" title="Lag en datafortelling">
          <BodyShort size="small">
            Les tabellene fra en Quarto-fortelling som kjører hver natt, og
            publiser den på Datamarkedsplassen. Alle i Nav kan lese den, så vis
            bare tall for grupper med minst fem svar.
          </BodyShort>
          <ExternalLink href={`${BIGQUERY_GUIDE_URL}#datafortelling`}>
            Slik lager du en datafortelling
          </ExternalLink>
        </Step>
      </HGrid>
    </VStack>
  );
}
