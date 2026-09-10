import {
  Alert,
  BodyShort,
  Box,
  Checkbox,
  CheckboxGroup,
  Heading,
  TextField,
  VStack,
} from "@navikt/ds-react";
import { useState } from "react";
import type {
  AnalysisCatalog,
  AnalysisDocument,
} from "~/types/analysisProducts";

export function DataSelection({
  catalog,
  document,
  onChange,
  errors,
}: {
  catalog: AnalysisCatalog;
  document: AnalysisDocument;
  onChange: (document: AnalysisDocument) => void;
  errors?: { sources?: string; dimensionKeys?: string };
}) {
  const [search, setSearch] = useState("");
  const sources = [
    ...catalog.sources,
    ...document.sources
      .filter(
        (selection) =>
          !catalog.sources.some(
            (source) =>
              source.app === selection.app &&
              source.surveyId === selection.surveyId,
          ),
      )
      .map(
        (selection) =>
          ({
            ...selection,
            archived: false,
            definitionStatus: "MISSING",
            flowStatus: "UNPINNED",
            warnings: [],
            fields: [],
          }) as AnalysisCatalog["sources"][number],
      ),
  ];
  const query = search.trim().toLowerCase();
  const matches = (source: AnalysisCatalog["sources"][number]) =>
    `${source.app} ${source.surveyId}`.toLowerCase().includes(query);
  const selected = (source: AnalysisCatalog["sources"][number]) =>
    document.sources.some(
      (selection) =>
        selection.app === source.app && selection.surveyId === source.surveyId,
    );
  const matchingSources = sources.filter(matches);
  const retainedSources = sources.filter(
    (source) => !matches(source) && selected(source),
  );
  function setSource(app: string, surveyId: string, fields: string[] | null) {
    const others = document.sources.filter(
      (source) => source.app !== app || source.surveyId !== surveyId,
    );
    onChange({
      ...document,
      sources:
        fields === null
          ? others
          : [...others, { app, surveyId, fieldIds: fields }],
    });
  }
  return (
    <VStack gap="space-20">
      <div>
        <Heading level="2" size="medium" spacing>
          Datagrunnlag
        </Heading>
        <BodyShort>
          Velg surveys og bare feltene dere trenger. En survey uten valgte felt
          gir fortsatt én rad per svar.
        </BodyShort>
        <BodyShort size="small" textColor="subtle">
          Felt uten registrert etikett vises med sin stabile felt-ID.
        </BodyShort>
      </div>
      <TextField
        label="Søk etter app eller survey"
        size="small"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {errors?.sources && <Alert variant="error">{errors.sources}</Alert>}
      {query && (
        <div role="status">
          <BodyShort size="small">
            {matchingSources.length === 0
              ? "Ingen surveys samsvarer med søket."
              : `${matchingSources.length.toLocaleString("nb-NO")} ${matchingSources.length === 1 ? "survey samsvarer" : "surveys samsvarer"} med søket.`}
          </BodyShort>
          {retainedSources.length > 0 && (
            <BodyShort size="small" textColor="subtle">
              Valgte surveys vises også, slik at du kan endre utvalget.
            </BodyShort>
          )}
        </div>
      )}
      {sources.length === 0 && (
        <Alert variant="info">
          Ingen surveys i kildekatalogen ennå. Utkastet kan lagres, men trenger
          en survey med registrert V2-definisjon før det kan låses.
        </Alert>
      )}
      {[...matchingSources, ...retainedSources].map((source) => {
        const selected = document.sources.find(
          (selection) =>
            selection.app === source.app &&
            selection.surveyId === source.surveyId,
        );
        const eligible =
          source.definitionStatus === "REGISTERED" &&
          source.flowStatus === "PINNED";
        const missing =
          selected?.fieldIds.filter(
            (id) => !source.fields.some((field) => field.fieldId === id),
          ) ?? [];
        return (
          <Box
            key={JSON.stringify([source.app, source.surveyId])}
            borderWidth="1"
            borderColor="neutral-subtle"
            borderRadius="8"
            padding="space-16"
          >
            <VStack gap="space-12">
              <Checkbox
                checked={Boolean(selected)}
                disabled={!selected && !eligible}
                onChange={(event) =>
                  setSource(
                    source.app,
                    source.surveyId,
                    event.target.checked ? [] : null,
                  )
                }
                description={`${source.app}${source.archived ? " · Arkivert survey" : ""}`}
              >
                {source.surveyId}
              </Checkbox>
              {!eligible && (
                <BodyShort size="small" textColor="subtle">
                  Mangler tilgjengelig V2-definisjon eller låst flyt. Et lagret
                  valg beholdes til du selv fjerner det.
                </BodyShort>
              )}
              {selected && (
                <CheckboxGroup
                  legend={`Svarfelt i ${source.surveyId}`}
                  description={
                    source.fields.some(
                      (field) =>
                        field.fieldType === "TEXT" ||
                        field.fieldType === "DATE",
                    )
                      ? "Fritekst og datosvar er ikke med i analyseeksporten."
                      : undefined
                  }
                  size="small"
                  value={selected.fieldIds}
                  onChange={(values: string[]) =>
                    setSource(source.app, source.surveyId, values)
                  }
                >
                  {source.fields.map((field) => {
                    const allowed = [
                      "RATING",
                      "SINGLE_CHOICE",
                      "MULTI_CHOICE",
                    ].includes(field.fieldType);
                    const details = !allowed
                      ? "Fritekst og datosvar er ikke med i analyseeksporten."
                      : [
                          field.fieldType === "RATING"
                            ? "Vurdering"
                            : field.fieldType === "MULTI_CHOICE"
                              ? "Flervalg"
                              : "Enkeltvalg",
                          field.optionIds?.length
                            ? `${field.optionIds.length} alternativer (alle inngår)`
                            : null,
                          field.flowDependencies.length
                            ? `Avhenger av: ${field.flowDependencies.map((dependency) => dependency.key).join(", ")}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                    return (
                      <Checkbox
                        key={field.fieldId}
                        value={field.fieldId}
                        disabled={
                          !allowed && !selected.fieldIds.includes(field.fieldId)
                        }
                        description={allowed ? details : undefined}
                      >
                        {field.label ?? field.fieldId}
                      </Checkbox>
                    );
                  })}
                  {missing.map((id) => (
                    <Checkbox
                      key={id}
                      value={id}
                      description="Ikke lenger tilgjengelig. Fjern valget eller undersøk surveyen."
                    >
                      {id}
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              )}
            </VStack>
          </Box>
        );
      })}
      <CheckboxGroup
        legend="Metadata"
        error={errors?.dimensionKeys}
        description="Bare registrerte dimensjoner kan velges. Rå metadata og klientetiketter følger ikke med."
        value={document.dimensionKeys}
        onChange={(dimensionKeys: string[]) =>
          onChange({ ...document, dimensionKeys })
        }
      >
        {catalog.dimensions.map((dimension) => (
          <Checkbox
            key={dimension.key}
            value={dimension.key}
            description={dimension.allowedValues.join(", ")}
          >
            {dimension.description}
          </Checkbox>
        ))}
        {document.dimensionKeys
          .filter(
            (key) =>
              !catalog.dimensions.some((dimension) => dimension.key === key),
          )
          .map((key) => (
            <Checkbox
              key={key}
              value={key}
              description="Ikke lenger tilgjengelig."
            >
              {key}
            </Checkbox>
          ))}
      </CheckboxGroup>
      <Checkbox
        checked={document.includeSubmittedHour}
        onChange={(event) =>
          onChange({ ...document, includeSubmittedHour: event.target.checked })
        }
        description="Dato følger alltid med. Tidspunkt på timen gir mer detaljer og bør bare velges når dere trenger det."
      >
        Ta med innsendt time
      </Checkbox>
    </VStack>
  );
}
