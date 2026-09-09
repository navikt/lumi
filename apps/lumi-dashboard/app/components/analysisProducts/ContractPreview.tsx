import {
  Alert,
  BodyShort,
  Box,
  Heading,
  ReadMore,
  Select,
  Table,
  Tag,
  VStack,
} from "@navikt/ds-react";
import { useState } from "react";
import {
  type AnalysisPreview,
  analysisIssueText,
} from "~/types/analysisProducts";

const labels = {
  WIDE: "Svar — én rad per innsending",
  LONG: "Svarfelt — én rad per verdi",
  FIELD_CATALOG: "Feltkatalog",
  MANIFEST: "Publiseringsstatus",
};
export function ContractPreview({ preview }: { preview: AnalysisPreview }) {
  const [resourceName, setResourceName] = useState("");
  const resource =
    preview.resources.find((item) => item.name === resourceName) ??
    preview.resources[0];
  return (
    <VStack gap="space-16">
      <div>
        <Heading level="2" size="medium" spacing>
          Kontroller tabellene
        </Heading>
        <Tag variant="outline" data-color="info" size="small">
          Syntetiske eksempeldata
        </Tag>
      </div>
      <BodyShort>
        Dette viser formatet, ikke ekte svar, antall eller fordeling. Felter og
        kolonner bestemmes av den lagrede kontrakten.
      </BodyShort>
      {preview.issues.map((issue) => (
        <Alert
          key={JSON.stringify(issue)}
          variant={issue.severity === "BLOCKER" ? "warning" : "info"}
          size="small"
        >
          {analysisIssueText[issue.code] ??
            `Kontrakten trenger kontroll (${issue.code}).`}
          {[
            issue.sourceApp,
            issue.sourceSurveyId,
            issue.fieldId,
            issue.dimensionKey,
          ].filter(Boolean).length > 0 && (
            <BodyShort size="small">
              {[
                issue.sourceApp,
                issue.sourceSurveyId,
                issue.fieldId,
                issue.dimensionKey,
              ]
                .filter(Boolean)
                .join(" · ")}
            </BodyShort>
          )}
        </Alert>
      ))}
      {preview.publicationSpecification && (
        <PinnedSelection specification={preview.publicationSpecification} />
      )}
      {resource && (
        <>
          <Select
            label="Tabell"
            size="small"
            value={resource.name}
            onChange={(event) => setResourceName(event.target.value)}
          >
            {preview.resources.map((item) => (
              <option key={item.name} value={item.name}>
                {labels[item.kind]}
                {item.sourceSurveyId
                  ? ` · ${item.sourceApp} / ${item.sourceSurveyId}`
                  : ""}
              </option>
            ))}
          </Select>
          <BodyShort size="small" textColor="subtle">
            {resource.columns.length.toLocaleString("nb-NO")} kolonner ·{" "}
            {resource.rowMeaning}
          </BodyShort>
          {(resource.kind === "WIDE" || resource.kind === "LONG") && (
            <BodyShort size="small">
              {resource.kind === "WIDE"
                ? "Denne tabellen har én rad per innsending. Bruk den for å telle innsendinger."
                : "Én innsending kan gi flere rader her, særlig ved flervalg. Antall rader er derfor ikke antall innsendinger."}{" "}
              NULL betyr ingen verdi, ikke 0 eller et ikke-valgt alternativ.
            </BodyShort>
          )}
          <Box
            style={{ overflowX: "auto", maxWidth: "100%" }}
            tabIndex={0}
            role="region"
            aria-label="Eksempelrader, rull vannrett for alle kolonner"
          >
            <Table size="small">
              <caption>{resource.name}</caption>
              <Table.Header>
                <Table.Row>
                  {resource.columns.map((column) => (
                    <Table.HeaderCell key={column.name} scope="col">
                      {column.name}
                    </Table.HeaderCell>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {resource.syntheticRows.map((row) => (
                  <Table.Row key={JSON.stringify(row)}>
                    {resource.columns.map((column) => (
                      <Table.DataCell key={column.name}>
                        {row[column.name] == null ? (
                          <abbr title="Ingen verdi">NULL</abbr>
                        ) : (
                          String(row[column.name])
                        )}
                      </Table.DataCell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </Box>
          <Box
            style={{ overflowX: "auto", maxWidth: "100%" }}
            tabIndex={0}
            role="region"
            aria-label="Kolonnebeskrivelser"
          >
            <Table size="small">
              <caption>Kolonner og betydning</caption>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell scope="col">Kolonne</Table.HeaderCell>
                  <Table.HeaderCell scope="col">Type</Table.HeaderCell>
                  <Table.HeaderCell scope="col">Kan mangle</Table.HeaderCell>
                  <Table.HeaderCell scope="col">Betydning</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {resource.columns.map((column) => (
                  <Table.Row key={column.name}>
                    <Table.HeaderCell scope="row">
                      {column.name}
                    </Table.HeaderCell>
                    <Table.DataCell>{column.type}</Table.DataCell>
                    <Table.DataCell>
                      {column.nullable ? "Ja" : "Nei"}
                    </Table.DataCell>
                    <Table.DataCell>{column.description}</Table.DataCell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </Box>
        </>
      )}
      <BodyShort size="small" textColor="subtle">
        Fritekst, rå JSON, klientetiketter, URL-er og interne svar-ID-er er ikke
        med.
      </BodyShort>
    </VStack>
  );
}

function PinnedSelection({
  specification,
}: {
  specification: NonNullable<AnalysisPreview["publicationSpecification"]>;
}) {
  const fieldCount = specification.sources.reduce(
    (total, source) => total + source.selectedFieldIds.length,
    0,
  );
  return (
    <VStack gap="space-8">
      <BodyShort size="small">
        {specification.sources.length.toLocaleString("nb-NO")}{" "}
        {specification.sources.length === 1 ? "survey" : "surveys"} ·{" "}
        {fieldCount.toLocaleString("nb-NO")}{" "}
        {fieldCount === 1 ? "valgt" : "valgte"} svarfelt
      </BodyShort>
      <ReadMore header="Felt og tillatte verdier" size="small">
        <VStack gap="space-16">
          <BodyShort size="small">
            Dette er hele feltutvalget fra API-ets kontrakt, ikke bare verdiene
            i eksempelradene. Alternativene omfatter alle tillatte historiske
            definisjoner; de fantes ikke nødvendigvis i alle versjoner. Stabile
            felt- og alternativ-ID-er vises uten klientetiketter.
          </BodyShort>
          {specification.sources.map((source) => (
            <Box
              key={JSON.stringify([source.app, source.surveyId])}
              style={{ overflowWrap: "anywhere" }}
            >
              <Heading level="3" size="xsmall" spacing>
                {source.app} / {source.surveyId}
              </Heading>
              {source.selectedFieldIds.length === 0 ? (
                <BodyShort size="small">
                  Bare innsendinger, ingen svarfelt.
                </BodyShort>
              ) : (
                <VStack as="dl" gap="space-12" margin="space-0">
                  {source.selectedFieldIds.map((fieldId) => {
                    const versions = source.definitions.flatMap((definition) =>
                      definition.fields.filter(
                        (field) =>
                          field.fieldId === fieldId &&
                          field.presence === "PRESENT",
                      ),
                    );
                    const options = [
                      ...new Set(
                        versions.flatMap((field) => field.availableOptionIds),
                      ),
                    ].sort();
                    const descriptions = [
                      ...new Set(
                        versions.map((field) => {
                          if (field.fieldType === "RATING") {
                            const minimum =
                              field.ratingVariant === "nps" ? 0 : 1;
                            const maximum =
                              field.ratingScale === null
                                ? "ukjent"
                                : field.ratingScale - (minimum === 0 ? 1 : 0);
                            const labels = {
                              nps: "NPS",
                              emoji: "Emoji",
                              stars: "Stjerner",
                              thumbs: "Tommelvurdering",
                            };
                            return `${field.ratingVariant ? labels[field.ratingVariant] : "Vurdering"}: ${minimum}–${maximum}`;
                          }
                          return field.fieldType === "MULTI_CHOICE"
                            ? `Flervalg${field.maxSelections === null ? "" : ` · maks ${field.maxSelections} valg`}`
                            : "Enkeltvalg";
                        }),
                      ),
                    ];
                    const hasAbsentVersion = source.definitions.some(
                      (definition) =>
                        definition.fields.some(
                          (field) =>
                            field.fieldId === fieldId &&
                            field.presence === "ABSENT",
                        ),
                    );
                    return (
                      <div key={fieldId}>
                        <BodyShort as="dt" size="small" weight="semibold">
                          {fieldId}
                        </BodyShort>
                        <Box as="dd" margin="space-0">
                          <BodyShort size="small">
                            {descriptions.join("; ")}
                          </BodyShort>
                          {options.length > 0 && (
                            <BodyShort size="small">
                              Tillatte alternativ-ID-er: {options.join(", ")}
                            </BodyShort>
                          )}
                          {hasAbsentVersion && (
                            <BodyShort size="small" textColor="subtle">
                              Feltet finnes ikke i alle tillatte definisjoner.
                              Eldre svar kan ha applicable=false.
                            </BodyShort>
                          )}
                        </Box>
                      </div>
                    );
                  })}
                </VStack>
              )}
            </Box>
          ))}
        </VStack>
      </ReadMore>
    </VStack>
  );
}
