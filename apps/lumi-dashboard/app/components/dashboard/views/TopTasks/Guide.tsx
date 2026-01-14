import { InformationIcon, LightBulbIcon } from "@navikt/aksel-icons";
import {
  Accordion,
  BodyShort,
  Box,
  HStack,
  Heading,
  Link,
  List,
  VStack,
} from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";

/**
 * In-app documentation and guidance for the Top Tasks methodology.
 * Provides explanations of key metrics and best practices.
 */
export function TopTasksGuide() {
  return (
    <DashboardCard padding="0" style={{ overflow: "hidden" }}>
      <Box.New
        padding={{ xs: "space-16", md: "space-24" }}
        borderWidth="0 0 1 0"
        borderColor="neutral-subtle"
      >
        <HStack gap="space-8" align="center">
          <span
            style={{ color: "var(--ax-text-neutral-subtle)", display: "flex" }}
          >
            <InformationIcon fontSize="1.25rem" aria-hidden />
          </span>
          <Heading size="small">Top Tasks Guide</Heading>
        </HStack>
        <BodyShort
          size="small"
          textColor="subtle"
          style={{ marginTop: "0.25rem" }}
        >
          Forstå metodikken og metrikker
        </BodyShort>
      </Box.New>

      <Box.New padding={{ xs: "space-16", md: "space-24" }}>
        <Accordion>
          <Accordion.Item>
            <Accordion.Header>
              <HStack gap="space-8" align="center">
                <LightBulbIcon aria-hidden />
                Hva er Top Tasks?
              </HStack>
            </Accordion.Header>
            <Accordion.Content>
              <VStack gap="space-12">
                <BodyShort>
                  Top Tasks er en metodikk utviklet av Gerry McGovern for å
                  identifisere og optimalisere de viktigste oppgavene brukere
                  kommer til et nettsted for å gjøre.
                </BodyShort>
                <BodyShort>
                  Metoden baserer seg på at{" "}
                  <strong>de 5-10 viktigste oppgavene</strong> typisk utgjør
                  80%+ av det brukerne prøver å gjøre ("long neck"
                  distribusjon).
                </BodyShort>
              </VStack>
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item>
            <Accordion.Header>Survey-typer</Accordion.Header>
            <Accordion.Content>
              <List as="ul" size="small">
                <List.Item>
                  <strong>Discovery Survey:</strong> Fritekst - "Hva kom du hit
                  for å gjøre?" Brukes til å oppdage hvilke oppgaver brukere
                  har.
                </List.Item>
                <List.Item>
                  <strong>Priority Survey:</strong> Brukere velger 5 viktigste
                  oppgaver fra en liste. Krever 400+ svar for statistisk
                  signifikans.
                </List.Item>
                <List.Item>
                  <strong>Top Tasks Survey:</strong> Velg oppgave + rapporter
                  suksess (Ja/Delvis/Nei). Måler løpende fullføringsrate.
                </List.Item>
              </List>
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item>
            <Accordion.Header>
              TPI - Task Performance Indicator
            </Accordion.Header>
            <Accordion.Content>
              <VStack gap="space-12">
                <BodyShort>
                  TPI kombinerer suksessrate med tidseffektivitet for å gi et
                  helhetlig bilde av oppgaveytelse.
                </BodyShort>
                <Box.New
                  padding="space-12"
                  background="neutral-softA"
                  borderRadius="medium"
                >
                  <BodyShort size="small" weight="semibold">
                    TPI = Suksessrate × min(1, Måltid / Faktisk tid) × 100
                  </BodyShort>
                </Box.New>
                <List as="ul" size="small">
                  <List.Item>
                    <strong>TPI ≥ 80:</strong> Utmerket - brukere fullfører
                    raskt og vellykket
                  </List.Item>
                  <List.Item>
                    <strong>TPI 60-79:</strong> Akseptabelt - rom for forbedring
                  </List.Item>
                  <List.Item>
                    <strong>TPI {"<"} 60:</strong> Kritisk - undersøk årsaker
                  </List.Item>
                </List>
              </VStack>
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item>
            <Accordion.Header>Beste praksis</Accordion.Header>
            <Accordion.Content>
              <List as="ol" size="small">
                <List.Item>
                  <strong>Start med Discovery:</strong> Finn ut hva brukere
                  faktisk prøver å gjøre før du lager forhåndsdefinerte
                  alternativer.
                </List.Item>
                <List.Item>
                  <strong>Kjør Priority Survey:</strong> Få minimum 400 svar for
                  å identifisere "long neck" oppgavene.
                </List.Item>
                <List.Item>
                  <strong>Mål løpende:</strong> Bruk Top Tasks Survey for
                  kontinuerlig overvåking av suksessrate og TPI.
                </List.Item>
                <List.Item>
                  <strong>Analyser blokkere:</strong> Se på årsaker til at
                  brukere ikke fullfører for å prioritere forbedringer.
                </List.Item>
                <List.Item>
                  <strong>Segmenter:</strong> Sjekk om visse enheter eller
                  brukergrupper har dårligere ytelse.
                </List.Item>
              </List>
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item>
            <Accordion.Header>Ressurser</Accordion.Header>
            <Accordion.Content>
              <List as="ul" size="small">
                <List.Item>
                  <Link
                    href="https://gerrymcgovern.com/books/top-tasks-a-how-to-guide/"
                    target="_blank"
                  >
                    Top Tasks: A How-to Guide - Gerry McGovern
                  </Link>
                </List.Item>
                <List.Item>
                  <Link href="https://aksel.nav.no" target="_blank">
                    Aksel - NAV Design System
                  </Link>
                </List.Item>
              </List>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </Box.New>
    </DashboardCard>
  );
}
