import { ExternalLinkIcon } from "@navikt/aksel-icons";
import {
  BodyShort,
  Box,
  CopyButton,
  Detail,
  Heading,
  HGrid,
  Link,
  VStack,
} from "@navikt/ds-react";
import type { ReactNode } from "react";
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
        <Detail>{step}</Detail>
        <Heading level="3" size="small">
          {title}
        </Heading>
        {children}
      </VStack>
    </Box>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} target="_blank" rel="noreferrer">
      {children}
      <ExternalLinkIcon aria-hidden />
    </Link>
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
        columns={{ xs: 1, md: 2 }}
        gap="space-12"
        style={{ listStyle: "none", margin: 0, paddingInlineStart: 0 }}
      >
        <Step step="01" title="Registrer dataproduktet">
          <BodyShort size="small">
            Legg til tabellene svar og innsendinger i et dataprodukt på
            Datamarkedsplassen. Velg at de inneholder personopplysninger.
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
          <ExternalLink href={MARKETPLACE_NEW_PRODUCT_URL}>
            Åpne Datamarkedsplassen
          </ExternalLink>
        </Step>
        <Step step="02" title="Gi tilgang og legg til i Metabase">
          <BodyShort size="small">
            Metabase gir bare tilgang til personer som har fått tilgang hver for
            seg på Datamarkedsplassen. Gruppetilgang følger ikke med. Velg
            deretter Legg til i Metabase.
          </BodyShort>
          <ExternalLink href={METABASE_GUIDE_URL}>
            Slik fungerer tilgang i Metabase
          </ExternalLink>
        </Step>
        <Step step="03" title="Lag spørsmål og dashboard">
          <BodyShort size="small">
            Tabellen svar har spørsmålstekst og svartekst på hver rad, så den
            fungerer i Metabase uten SQL. Lumi-dokumentasjonen har ferdige
            spørringer for fordeling, snitt og NPS.
          </BodyShort>
          <ExternalLink href={`${BIGQUERY_GUIDE_URL}#metabase`}>
            Se oppskriftene
          </ExternalLink>
        </Step>
        <Step step="04" title="Lag en datafortelling">
          <BodyShort size="small">
            Les tabellene fra en Quarto-fortelling som kjører hver natt, og
            publiser den på Datamarkedsplassen.
          </BodyShort>
          <ExternalLink href={`${BIGQUERY_GUIDE_URL}#datafortelling`}>
            Slik lager dere en datafortelling
          </ExternalLink>
        </Step>
      </HGrid>
    </VStack>
  );
}
