import {
  Alert,
  BodyShort,
  Box,
  Button,
  Checkbox,
  Heading,
  HStack,
  Loader,
  Select,
  Tag,
  TextField,
  VStack,
} from "@navikt/ds-react";
import type {
  SurveyDocumentV1,
  SurveyPageV1,
  SurveyQuestionV1,
} from "@navikt/lumi-survey";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  fetchSurveyAuthoringProjectServerFn,
  saveSurveyAuthoringDraftServerFn,
} from "~/server/actions";
import type { SurveyAuthoringProject } from "~/types/surveyAuthoring";
import styles from "./surveyverksted-editor.module.css";

const searchSchema = z.object({ team: z.string().min(1) });

interface EditableDraft {
  name: string;
  surveyId: string;
  document: SurveyDocumentV1;
}

export const Route = createFileRoute("/surveyverksted/$projectId")({
  validateSearch: zodValidator(searchSchema),
  component: SurveyWorkshopEditorRoute,
});

function SurveyWorkshopEditorRoute() {
  const { projectId } = Route.useParams();
  const { team } = Route.useSearch();
  const projectQuery = useQuery({
    queryKey: ["survey-authoring-project", team, projectId],
    queryFn: () =>
      fetchSurveyAuthoringProjectServerFn({ data: { team, projectId } }),
  });

  if (projectQuery.isPending) {
    return (
      <Box as="main" padding="space-32" className={styles.loading}>
        <Loader size="large" title="Åpner utkast" />
      </Box>
    );
  }

  if (projectQuery.isError) {
    return (
      <Box as="main" padding="space-32" className="main-container">
        <Alert variant="error">Utkastet kunne ikke åpnes.</Alert>
      </Box>
    );
  }

  return (
    <SurveyWorkshopEditor
      key={`${projectQuery.data.id}:${projectQuery.data.draftVersion}`}
      project={projectQuery.data}
    />
  );
}

function SurveyWorkshopEditor({
  project,
}: {
  project: SurveyAuthoringProject;
}) {
  const [draft, setDraft] = useState<EditableDraft>(() => ({
    name: project.name,
    surveyId: project.surveyId,
    document: project.document,
  }));
  const [draftVersion, setDraftVersion] = useState(project.draftVersion);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    JSON.stringify({
      name: project.name,
      surveyId: project.surveyId,
      document: project.document,
    }),
  );
  const [selectedPageId, setSelectedPageId] = useState(
    project.document.pages[0].id,
  );

  const fingerprint = useMemo(() => JSON.stringify(draft), [draft]);
  const hasRequiredMetadata = Boolean(
    draft.name.trim() && draft.surveyId.trim(),
  );

  const saveMutation = useMutation({
    mutationFn: (variables: EditableDraft & { expectedVersion: number }) =>
      saveSurveyAuthoringDraftServerFn({
        data: {
          team: project.team,
          projectId: project.id,
          expectedVersion: variables.expectedVersion,
          name: variables.name,
          surveyId: variables.surveyId,
          document: variables.document,
        },
      }),
    onSuccess: (saved, variables) => {
      setDraftVersion(saved.draftVersion);
      setSavedFingerprint(
        JSON.stringify({
          name: variables.name,
          surveyId: variables.surveyId,
          document: variables.document,
        }),
      );
    },
  });

  useEffect(() => {
    if (
      fingerprint === savedFingerprint ||
      !hasRequiredMetadata ||
      saveMutation.isPending ||
      saveMutation.isError
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      saveMutation.mutate({ ...draft, expectedVersion: draftVersion });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [
    draft,
    draftVersion,
    fingerprint,
    hasRequiredMetadata,
    saveMutation,
    savedFingerprint,
  ]);

  const selectedPage =
    draft.document.pages.find((page) => page.id === selectedPageId) ??
    draft.document.pages[0];
  const isDirty = fingerprint !== savedFingerprint;

  const updateDocument = (document: SurveyDocumentV1) =>
    setDraft((current) => ({ ...current, document }));

  const updatePage = (
    pageId: string,
    updater: (page: SurveyPageV1) => SurveyPageV1,
  ) => {
    updateDocument({
      ...draft.document,
      pages: draft.document.pages.map((page) =>
        page.id === pageId ? updater(page) : page,
      ) as SurveyDocumentV1["pages"],
    });
  };

  const addPage = () => {
    const id = `side-${crypto.randomUUID().slice(0, 8)}`;
    const page: SurveyPageV1 = {
      id,
      title: "Ny side",
      questions: [createQuestion("rating")],
    };
    updateDocument({
      ...draft.document,
      pages: [...draft.document.pages, page],
    });
    setSelectedPageId(id);
  };

  const removePage = (pageId: string) => {
    if (draft.document.pages.length === 1) return;
    const remaining = draft.document.pages.filter((page) => page.id !== pageId);
    updateDocument({
      ...draft.document,
      pages: remaining as SurveyDocumentV1["pages"],
    });
    if (selectedPageId === pageId) setSelectedPageId(remaining[0].id);
  };

  const updateQuestion = (
    pageId: string,
    questionId: string,
    updater: (question: SurveyQuestionV1) => SurveyQuestionV1,
  ) =>
    updatePage(pageId, (page) => ({
      ...page,
      questions: page.questions.map((question) =>
        question.id === questionId ? updater(question) : question,
      ) as SurveyPageV1["questions"],
    }));

  const addQuestion = (type: "rating" | "text") =>
    updatePage(selectedPage.id, (page) => ({
      ...page,
      questions: [...page.questions, createQuestion(type)],
    }));

  const removeQuestion = (questionId: string) => {
    if (selectedPage.questions.length === 1) return;
    updatePage(selectedPage.id, (page) => ({
      ...page,
      questions: page.questions.filter(
        (question) => question.id !== questionId,
      ) as SurveyPageV1["questions"],
    }));
  };

  const previewHref = `/survey-preview?team=${encodeURIComponent(project.team)}&projectId=${encodeURIComponent(project.id)}&version=${draftVersion}`;

  return (
    <main className={styles.editorShell}>
      <div className={styles.editorTopbar}>
        <HStack gap="space-12" align="center" wrap>
          <Link to="/surveyverksted" search={{ team: project.team }}>
            <Button data-color="neutral" variant="tertiary" size="small">
              Til utkast
            </Button>
          </Link>
          <div>
            <Heading size="medium" level="1">
              {draft.name || "Uten navn"}
            </Heading>
            <BodyShort size="small" textColor="subtle">
              {project.team} · {draft.surveyId || "Mangler survey-ID"}
            </BodyShort>
          </div>
        </HStack>
        <SaveStatus
          isDirty={isDirty}
          isPending={saveMutation.isPending}
          isError={saveMutation.isError}
          hasRequiredMetadata={hasRequiredMetadata}
          version={draftVersion}
        />
      </div>

      {saveMutation.isError ? (
        <Alert variant="error" className={styles.saveAlert}>
          Utkastet ble ikke lagret. Det kan ha blitt endret i en annen fane.
          Last siden på nytt før du fortsetter.
        </Alert>
      ) : null}

      <div className={styles.editorGrid}>
        <aside className={styles.outline} aria-label="Struktur">
          <VStack gap="space-20">
            <div>
              <Heading size="small" level="2" spacing>
                Dokument
              </Heading>
              <VStack gap="space-12">
                <TextField
                  label="Navn på utkastet"
                  size="small"
                  value={draft.name}
                  error={!draft.name.trim() ? "Navn er påkrevd" : undefined}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
                <TextField
                  label="Foreslått survey-ID"
                  size="small"
                  value={draft.surveyId}
                  error={
                    !draft.surveyId.trim() ? "Survey-ID er påkrevd" : undefined
                  }
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      surveyId: event.target.value,
                    }))
                  }
                />
              </VStack>
            </div>

            <div>
              <HStack justify="space-between" align="center" gap="space-8">
                <Heading size="small" level="2">
                  Sider
                </Heading>
                <Button size="xsmall" variant="tertiary" onClick={addPage}>
                  Ny side
                </Button>
              </HStack>
              <ol className={styles.pageList}>
                {draft.document.pages.map((page, index) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      className={styles.pageButton}
                      data-selected={page.id === selectedPage.id}
                      onClick={() => setSelectedPageId(page.id)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <span>{page.title?.trim() || "Side uten tittel"}</span>
                      <small>{page.questions.length} spørsmål</small>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </VStack>
        </aside>

        <section
          className={styles.canvas}
          aria-labelledby="page-editor-heading"
        >
          <VStack gap="space-24">
            <HStack justify="space-between" align="start" gap="space-16">
              <div>
                <BodyShort size="small" textColor="subtle">
                  Side {draft.document.pages.indexOf(selectedPage) + 1}
                </BodyShort>
                <Heading id="page-editor-heading" size="large" level="2">
                  Innhold
                </Heading>
              </div>
              <Button
                size="small"
                variant="tertiary"
                data-color="danger"
                disabled={draft.document.pages.length === 1}
                onClick={() => removePage(selectedPage.id)}
              >
                Slett side
              </Button>
            </HStack>

            <Box
              background="raised"
              borderRadius="12"
              borderWidth="1"
              borderColor="neutral-subtle"
              padding={{ xs: "space-16", md: "space-24" }}
            >
              <VStack gap="space-16">
                <TextField
                  label="Sidetittel"
                  value={selectedPage.title ?? ""}
                  onChange={(event) =>
                    updatePage(selectedPage.id, (page) => ({
                      ...page,
                      title: event.target.value || undefined,
                    }))
                  }
                />
                <TextField
                  label="Beskrivelse"
                  value={selectedPage.description ?? ""}
                  onChange={(event) =>
                    updatePage(selectedPage.id, (page) => ({
                      ...page,
                      description: event.target.value || undefined,
                    }))
                  }
                />
              </VStack>
            </Box>

            <VStack gap="space-12">
              {selectedPage.questions.map((question, index) => (
                <QuestionEditor
                  key={question.id}
                  index={index}
                  question={question}
                  canDelete={selectedPage.questions.length > 1}
                  onChange={(updater) =>
                    updateQuestion(selectedPage.id, question.id, updater)
                  }
                  onDelete={() => removeQuestion(question.id)}
                />
              ))}
            </VStack>

            <HStack gap="space-8" wrap>
              <Button variant="secondary" onClick={() => addQuestion("rating")}>
                Legg til vurdering
              </Button>
              <Button variant="secondary" onClick={() => addQuestion("text")}>
                Legg til tekstfelt
              </Button>
            </HStack>
          </VStack>
        </section>

        <aside className={styles.preview} aria-labelledby="preview-heading">
          <div className={styles.previewCard}>
            <VStack gap="space-20">
              <div>
                <Tag variant="warning" size="small">
                  Ingen innsending
                </Tag>
              </div>
              <div>
                <Heading id="preview-heading" size="medium" level="2" spacing>
                  Prøv den ekte widgeten
                </Heading>
                <BodyShort textColor="subtle">
                  Forhåndsvisningen åpnes separat, slik at docken får en ekte
                  viewport og dashboardets sikkerhetsgrenser beholdes.
                </BodyShort>
              </div>
              <div className={styles.previewStats}>
                <div>
                  <strong>{draft.document.pages.length}</strong>
                  <span>sider</span>
                </div>
                <div>
                  <strong>
                    {draft.document.pages.reduce(
                      (sum, page) => sum + page.questions.length,
                      0,
                    )}
                  </strong>
                  <span>spørsmål</span>
                </div>
                <div>
                  <strong>v{draftVersion}</strong>
                  <span>lagret</span>
                </div>
              </div>
              <Button
                as="a"
                href={previewHref}
                target="_blank"
                rel="noreferrer"
                variant="primary"
                className={styles.previewButton}
              >
                Åpne forhåndsvisning
              </Button>
              {isDirty ? (
                <BodyShort size="small" textColor="subtle">
                  Vent til utkastet er lagret for å se de siste endringene.
                </BodyShort>
              ) : null}
            </VStack>
          </div>
        </aside>
      </div>
    </main>
  );
}

function QuestionEditor({
  question,
  index,
  canDelete,
  onChange,
  onDelete,
}: {
  question: SurveyQuestionV1;
  index: number;
  canDelete: boolean;
  onChange: (updater: (question: SurveyQuestionV1) => SurveyQuestionV1) => void;
  onDelete: () => void;
}) {
  return (
    <Box
      background="raised"
      borderRadius="12"
      borderWidth="1"
      borderColor="neutral-subtle"
      padding={{ xs: "space-16", md: "space-24" }}
    >
      <VStack gap="space-16">
        <HStack justify="space-between" align="center" gap="space-12">
          <HStack gap="space-8" align="center">
            <span className={styles.questionNumber}>{index + 1}</span>
            <Heading size="small" level="3">
              Spørsmål
            </Heading>
          </HStack>
          <Button
            size="xsmall"
            variant="tertiary"
            data-color="danger"
            disabled={!canDelete}
            onClick={onDelete}
          >
            Fjern
          </Button>
        </HStack>
        <Select
          label="Type"
          value={question.type}
          onChange={(event) => {
            const type = event.target.value as "rating" | "text";
            onChange(() => ({
              ...createQuestion(type),
              id: question.id,
              prompt: question.prompt,
              description: question.description,
              required: question.required,
            }));
          }}
        >
          <option value="rating">Vurdering</option>
          <option value="text">Tekst</option>
        </Select>
        <TextField
          label="Spørsmålstekst"
          value={question.prompt}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              prompt: event.target.value,
            }))
          }
        />
        <TextField
          label="Hjelpetekst"
          value={question.description ?? ""}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              description: event.target.value || undefined,
            }))
          }
        />
        {question.type === "rating" ? (
          <Select
            label="Visning"
            value={question.variant ?? "emoji"}
            onChange={(event) =>
              onChange((current) => {
                if (current.type !== "rating") return current;
                return {
                  ...current,
                  variant: event.target.value as
                    | "emoji"
                    | "thumbs"
                    | "stars"
                    | "nps",
                };
              })
            }
          >
            <option value="emoji">Emoji (5)</option>
            <option value="thumbs">Tommel opp/ned</option>
            <option value="stars">Stjerner (5)</option>
            <option value="nps">NPS (0–10)</option>
          </Select>
        ) : null}
        <Checkbox
          checked={question.required ?? false}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              required: event.target.checked,
            }))
          }
        >
          Må besvares
        </Checkbox>
      </VStack>
    </Box>
  );
}

function SaveStatus({
  isDirty,
  isPending,
  isError,
  hasRequiredMetadata,
  version,
}: {
  isDirty: boolean;
  isPending: boolean;
  isError: boolean;
  hasRequiredMetadata: boolean;
  version: number;
}) {
  if (isError) return <Tag variant="error">Ikke lagret</Tag>;
  if (!hasRequiredMetadata) return <Tag variant="warning">Mangler felter</Tag>;
  if (isPending) return <Tag variant="info">Lagrer …</Tag>;
  if (isDirty) return <Tag variant="neutral">Venter på autosave</Tag>;
  return <Tag variant="success">Lagret · v{version}</Tag>;
}

function createQuestion(type: "rating" | "text"): SurveyQuestionV1 {
  const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
  if (type === "text") {
    return {
      id,
      type: "text",
      prompt: "Hva vil du fortelle oss?",
      maxLength: 1000,
      minRows: 4,
    };
  }
  return {
    id,
    type: "rating",
    prompt: "Hvordan opplevde du tjenesten?",
    variant: "emoji",
    required: true,
  };
}
