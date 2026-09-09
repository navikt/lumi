import {
  Alert,
  BodyLong,
  BodyShort,
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Heading,
  HGrid,
  HStack,
  Loader,
  Modal,
  Select,
  Textarea,
  TextField,
  VStack,
} from "@navikt/ds-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  createAnalysisProduct,
  getAnalysisPreview,
  getAnalysisProduct,
  lockAnalysisRelease,
  saveAnalysisDraft,
} from "~/server/actions/analysisProducts";
import {
  type AnalysisCatalog,
  type AnalysisConfirmation,
  type AnalysisDocument,
  AnalysisDocumentSchema,
  type AnalysisProduct,
  type AnalysisRelease,
  analysisConfirmation,
  emptyAnalysisDocument,
} from "~/types/analysisProducts";
import { ContractPreview } from "./ContractPreview";
import { DataSelection } from "./DataSelection";
import { ReviewDateInput } from "./ReviewDateInput";

const messages = {
  conflict:
    "Utkastet eller kildekatalogen er endret. Dine lokale valg er beholdt. Hent lagret utkast og kontroller det før du fortsetter.",
  "not-editable":
    "Utkastet kan ikke lenger redigeres. En annen bruker kan ha låst en release. Hent produktstatus på nytt.",
  blocked:
    "Kontrakten er blokkert. Hent en ny forhåndsvisning og kontroller datagrunnlaget.",
  limit:
    "Forespørselen er begrenset. Vent litt og prøv igjen. Ved opprettelse kan også grensen på ti aktive produktplasser være nådd.",
  "invalid-input":
    "API-et avviste verdiene. Kontroller navn, eiere, dato og datagrunnlag. Ingenting ble lagret.",
  "too-large":
    "Utkastet er for stort. Reduser datagrunnlaget før du prøver igjen. Ingenting ble lagret.",
  unavailable: "Produktet er ikke tilgjengelig for dette teamet.",
};

export function AnalysisEditor({
  team,
  product,
  catalog,
  onSaved,
  onLocked,
}: {
  team: string;
  product: AnalysisProduct | null;
  catalog: AnalysisCatalog;
  onSaved: (product: AnalysisProduct) => Promise<void>;
  onLocked: (release: AnalysisRelease) => Promise<void>;
}) {
  const cache = useQueryClient();
  const [document, setDocument] = useState<AnalysisDocument>(
    () => product?.draft?.document ?? emptyAnalysisDocument(),
  );
  const [savedDraft, setSavedDraft] = useState(product?.draft ?? null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [invalidPreview, setInvalidPreview] = useState(false);
  const [uncertainCreate, setUncertainCreate] = useState(false);
  const [confirmation, setConfirmation] = useState<AnalysisConfirmation | null>(
    null,
  );
  const [uncertainLock, setUncertainLock] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const inFlight = useRef(false);
  const navigatingAfterSave = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const errorRef = useRef<HTMLDivElement>(null);
  const dirty =
    JSON.stringify(document) !==
    JSON.stringify(savedDraft?.document ?? emptyAnalysisDocument());
  useBlocker({
    shouldBlockFn: () =>
      navigatingAfterSave.current
        ? false
        : (dirty || inFlight.current || uncertainLock) &&
          !window.confirm(
            "Du har ulagrede endringer eller en uavklart lagring. Forlate siden likevel?",
          ),
    enableBeforeUnload: () => dirty || inFlight.current || uncertainLock,
  });

  const preview = useQuery({
    queryKey: [
      "analysis-preview",
      team,
      product?.id,
      savedDraft?.id,
      savedDraft?.revision,
      savedDraft?.documentHash,
    ],
    queryFn: () => {
      if (!product) throw new Error("Lagre produktet først.");
      return getAnalysisPreview({ data: { team, productId: product.id } });
    },
    enabled: Boolean(
      product && savedDraft && !dirty && !invalidPreview && !confirmation,
    ),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const matchingPreview =
    preview.data &&
    savedDraft &&
    preview.data.productId === product?.id &&
    preview.data.draftId === savedDraft.id &&
    preview.data.draftRevision === savedDraft.revision &&
    preview.data.documentHash === savedDraft.documentHash;
  const canLock =
    !dirty &&
    !preview.isFetching &&
    !invalidPreview &&
    matchingPreview &&
    preview.data &&
    analysisConfirmation(preview.data);

  function fail(message: string) {
    if (!mounted.current) return;
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }
  const save = useMutation({
    mutationFn: (submitted: AnalysisDocument) =>
      product && savedDraft
        ? saveAnalysisDraft({
            data: {
              team,
              productId: product.id,
              draftId: savedDraft.id,
              draftRevision: savedDraft.revision,
              document: submitted,
            },
          })
        : createAnalysisProduct({ data: { team, document: submitted } }),
    retry: false,
    onSuccess: async (result) => {
      if (!mounted.current) return;
      if (!result.ok) {
        setInvalidPreview(true);
        fail(messages[result.reason]);
        return;
      }
      setSavedDraft(result.value.draft);
      if (result.value.draft) setDocument(result.value.draft.document);
      setInvalidPreview(false);
      setError("");
      navigatingAfterSave.current = true;
      try {
        await onSaved(result.value);
      } finally {
        navigatingAfterSave.current = false;
      }
    },
    onError: () => {
      if (!mounted.current) return;
      setInvalidPreview(true);
      if (!product) setUncertainCreate(true);
      fail(
        product
          ? "Uklart om utkastet ble lagret. Hent lagret utkast før du prøver igjen. Dine valg er beholdt."
          : "Uklart om produktet ble opprettet. Kontroller produktoversikten før du oppretter et nytt; det kan allerede være lagret.",
      );
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const lock = useMutation({
    mutationFn: (snapshot: AnalysisConfirmation) => {
      if (!product) throw new Error("Lagre produktet først.");
      return lockAnalysisRelease({
        data: { team, productId: product.id, confirmation: snapshot },
      });
    },
    retry: false,
    onSuccess: async (result) => {
      if (!mounted.current) return;
      if (!result.ok) {
        setUncertainLock(false);
        setConfirmation(null);
        setInvalidPreview(true);
        fail(messages[result.reason]);
        return;
      }
      setUncertainLock(false);
      setConfirmation(null);
      navigatingAfterSave.current = true;
      try {
        await onLocked(result.value);
      } finally {
        navigatingAfterSave.current = false;
      }
    },
    onError: () => {
      if (!mounted.current) return;
      setUncertainLock(true);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const reload = useMutation({
    mutationFn: () => {
      if (!product) throw new Error("Produktet er ikke lagret.");
      return getAnalysisProduct({ data: { team, productId: product.id } });
    },
    onSuccess: async (latest) => {
      if (!mounted.current) return;
      setSavedDraft(latest.draft);
      if (latest.draft) setDocument(latest.draft.document);
      setReloadVersion((current) => current + 1);
      setConfirmation(null);
      setUncertainLock(false);
      setInvalidPreview(false);
      setError("");
      await onSaved(latest);
      await cache.invalidateQueries({
        queryKey: ["analysis-catalog", team],
        exact: true,
      });
      if (latest.draft?.revision === savedDraft?.revision)
        await preview.refetch();
    },
    onError: () =>
      fail("Produktstatus kunne ikke hentes. Dine valg er beholdt."),
  });
  const busy = save.isPending || lock.isPending || reload.isPending;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || uncertainCreate) return;
    const parsed = AnalysisDocumentSchema.safeParse(document);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            "Kontroller verdien i dette feltet.",
          ]),
        ),
      );
      fail("Kontroller de markerte feltene før du lagrer.");
      return;
    }
    setFieldErrors({});
    setError("");
    inFlight.current = true;
    save.mutate(parsed.data);
  }
  function update<K extends keyof AnalysisDocument>(
    key: K,
    value: AnalysisDocument[K],
  ) {
    setDocument((current) => ({ ...current, [key]: value }));
  }

  return (
    <VStack gap="space-32">
      <form onSubmit={submit}>
        <fieldset
          disabled={busy || Boolean(confirmation) || uncertainCreate}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <VStack gap="space-32">
            <Box
              background="raised"
              borderWidth="1"
              borderColor="neutral-subtle"
              borderRadius="12"
              padding={{ xs: "space-16", md: "space-24" }}
            >
              <VStack gap="space-20">
                <Heading level="2" size="medium">
                  Om produktet
                </Heading>
                <TextField
                  label="Navn"
                  value={document.name}
                  onChange={(event) => update("name", event.target.value)}
                  required
                  maxLength={120}
                  error={fieldErrors.name}
                />
                <Textarea
                  label="Hva skal dere bruke dataene til?"
                  value={document.purpose}
                  onChange={(event) => update("purpose", event.target.value)}
                  required
                  maxLength={2_000}
                  minRows={2}
                  error={fieldErrors.purpose}
                />
                <HGrid columns={{ xs: 1, md: 2 }} gap="space-20" align="end">
                  <TextField
                    label="Dataeier"
                    description="Ansvarlig person eller tydelig eierfunksjon."
                    value={document.dataOwner}
                    onChange={(event) =>
                      update("dataOwner", event.target.value)
                    }
                    required
                    maxLength={255}
                    error={fieldErrors.dataOwner}
                  />
                  <TextField
                    label="Teknisk ansvarlig"
                    value={document.technicalOwner}
                    onChange={(event) =>
                      update("technicalOwner", event.target.value)
                    }
                    required
                    maxLength={255}
                    error={fieldErrors.technicalOwner}
                  />
                  <Select
                    label="Hvor lenge trenger produktet dataene?"
                    value={document.retention}
                    onChange={(event) =>
                      update(
                        "retention",
                        event.target.value as AnalysisDocument["retention"],
                      )
                    }
                  >
                    <option value="DAYS_30">30 dager</option>
                    <option value="DAYS_90">90 dager</option>
                    <option value="DAYS_180">180 dager</option>
                    <option value="SOURCE_MAXIMUM">
                      Så lenge data finnes i Lumi
                    </option>
                  </Select>
                  <ReviewDateInput
                    key={reloadVersion}
                    initialValue={document.reviewDate}
                    onChange={(value) => update("reviewDate", value)}
                    error={fieldErrors.reviewDate}
                  />
                </HGrid>
                <CheckboxGroup
                  legend="Analyseverktøy"
                  value={document.useCases}
                  onChange={(values: AnalysisDocument["useCases"]) =>
                    update("useCases", values)
                  }
                  error={fieldErrors.useCases}
                >
                  <HStack gap="space-8 space-24">
                    <Checkbox value="METABASE">Metabase</Checkbox>
                    <Checkbox value="DATA_STORY_NOTEBOOK">
                      Datafortelling / notebook
                    </Checkbox>
                  </HStack>
                </CheckboxGroup>
                <TextField
                  label="Behandlingsreferanse (valgfritt)"
                  value={document.processingReference ?? ""}
                  onChange={(event) =>
                    update("processingReference", event.target.value || null)
                  }
                  maxLength={500}
                />
              </VStack>
            </Box>
            <Box
              background="raised"
              borderWidth="1"
              borderColor="neutral-subtle"
              borderRadius="12"
              padding={{ xs: "space-16", md: "space-24" }}
            >
              <DataSelection
                catalog={catalog}
                document={document}
                onChange={setDocument}
              />
            </Box>
          </VStack>
        </fieldset>
        <Box paddingBlock="space-20 space-0">
          <HStack gap="space-16" align="center">
            <Button
              type="submit"
              loading={save.isPending}
              disabled={
                busy || uncertainCreate || (!dirty && Boolean(savedDraft))
              }
            >
              Lagre utkast
            </Button>
            <BodyShort size="small" textColor="subtle" role="status">
              {dirty
                ? "Ulagrede endringer"
                : savedDraft
                  ? "Utkast lagret"
                  : "Ingen data publiseres"}
            </BodyShort>
          </HStack>
        </Box>
      </form>
      {error && (
        <div ref={errorRef} tabIndex={-1}>
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {product &&
        (invalidPreview ||
          preview.isError ||
          (preview.data && !matchingPreview)) && (
          <Button
            variant="secondary"
            loading={reload.isPending}
            onClick={() => {
              if (
                !dirty ||
                window.confirm(
                  "Erstatt dine lokale endringer med det lagrede utkastet?",
                )
              )
                reload.mutate();
            }}
          >
            Hent lagret utkast / produktstatus
          </Button>
        )}
      {dirty ? (
        <BodyShort textColor="subtle">
          Lagre endringene for å se en oppdatert forhåndsvisning.
        </BodyShort>
      ) : savedDraft && !invalidPreview ? (
        preview.isPending ? (
          <Loader title="Henter forhåndsvisning" />
        ) : preview.isError ? (
          <Alert variant="error">Forhåndsvisningen kunne ikke hentes.</Alert>
        ) : matchingPreview && preview.data ? (
          <Box
            background="raised"
            borderWidth="1"
            borderColor="neutral-subtle"
            borderRadius="12"
            padding={{ xs: "space-16", md: "space-24" }}
            style={{ minWidth: 0 }}
          >
            <VStack gap="space-24">
              <ContractPreview preview={preview.data} />
              {canLock && (
                <div>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setAcknowledged(false);
                      setConfirmation(canLock);
                    }}
                  >
                    Lås første release
                  </Button>
                </div>
              )}
            </VStack>
          </Box>
        ) : (
          <Alert variant="warning">
            Forhåndsvisningen gjelder en annen utgave av utkastet. Hent
            produktstatus på nytt.
          </Alert>
        )
      ) : null}
      <Modal
        open={Boolean(confirmation)}
        onBeforeClose={() => !inFlight.current && !uncertainLock}
        onClose={() => setConfirmation(null)}
        header={{ heading: "Lås første release?" }}
        width="small"
      >
        <Modal.Body>
          <VStack gap="space-16">
            <BodyLong>
              Du låser feltene og innstillingene i «{document.name}». Denne
              releasen kan ikke endres, og utkastet avsluttes. Det er foreløpig
              ikke mulig å opprette et nytt utkast fra releasen i denne
              løsningen.
            </BodyLong>
            <Alert variant="info" size="small">
              Dette publiserer ikke data. Levering til Metabase og
              Datafortelling aktiveres senere, separat.
            </Alert>
            <Checkbox
              checked={acknowledged}
              disabled={lock.isPending || uncertainLock}
              onChange={(event) => setAcknowledged(event.target.checked)}
            >
              Jeg har kontrollert datagrunnlaget og de syntetiske tabellene.
            </Checkbox>
            {uncertainLock && (
              <Alert variant="warning">
                Uklart om releasen ble låst. Prøv samme bekreftelse igjen — det
                oppretter ikke en ekstra release — eller kontroller
                produktstatus.
              </Alert>
            )}
          </VStack>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            disabled={lock.isPending || uncertainLock}
            onClick={() => setConfirmation(null)}
          >
            Avbryt
          </Button>
          {uncertainLock && (
            <Button
              variant="secondary"
              loading={reload.isPending}
              disabled={lock.isPending}
              onClick={() => reload.mutate()}
            >
              Kontroller produktstatus
            </Button>
          )}
          <Button
            loading={lock.isPending}
            disabled={!acknowledged || busy}
            onClick={() => {
              if (!confirmation || inFlight.current) return;
              inFlight.current = true;
              lock.mutate(confirmation);
            }}
          >
            {uncertainLock ? "Prøv samme bekreftelse igjen" : "Lås release"}
          </Button>
        </Modal.Footer>
      </Modal>
    </VStack>
  );
}
