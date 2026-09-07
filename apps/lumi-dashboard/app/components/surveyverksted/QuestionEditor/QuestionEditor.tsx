import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  PlusIcon,
  TrashIcon,
} from "@navikt/aksel-icons";
import {
  ActionMenu,
  Alert,
  BodyLong,
  BodyShort,
  Button,
  Checkbox,
  Detail,
  Heading,
  HStack,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Textarea,
  TextField,
  VStack,
} from "@navikt/ds-react";
import {
  type SurveyDocumentV1,
  type SurveyQuestionV1,
  validateSurveyDocumentV1,
} from "@navikt/lumi-survey";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildConditionSummaries } from "~/utils/conditionSummary";
import {
  deleteFromDocument,
  deletionPlan,
  insertQuestionPage,
  moveDocumentPage,
  moveDocumentQuestion,
  orderConflict,
  placeQuestion,
  replaceQuestion,
  ruleLeaves,
  sources,
} from "~/utils/questionEditorModel";
import {
  changeQuestionType,
  commitOptionLabel,
  createQuestion,
  findHandoffIssues,
  followUpBranches,
  isRequiredSpecializedQuestion,
  isSurveyTemplatePlaceholderValue,
  type QuestionTypeId,
} from "~/utils/surveyDocument";
import { StageSurface } from "../StageSurface";
import { QuestionAudience } from "./QuestionAudience";
import styles from "./questionEditor.module.css";

interface Props {
  document: SurveyDocumentV1;
  surveyId: string;
  onChange: (document: SurveyDocumentV1) => void;
  onAdvanced: () => void;
}
export function QuestionEditor({
  document,
  surveyId,
  onChange,
  onAdvanced,
}: Props) {
  const [selected, setSelected] = useState(document.pages[0].questions[0].id);
  const [selectedScreen, setSelectedScreen] = useState<
    "$intro" | "$success" | null
  >(null);
  const [mode, setMode] = useState<"build" | "try">("build");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [history, setHistory] = useState<
    {
      document: SurveyDocumentV1;
      selected: string;
      selectedScreen: "$intro" | "$success" | null;
    }[]
  >([]);
  const editSession = useRef<string | null>(null);
  const editorRef = useRef<HTMLElement>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [restart, setRestart] = useState(0);
  const [skipIntro, setSkipIntro] = useState(false);
  const current = useRef(document);
  current.current = document;
  const lastOwnChange = useRef(document);
  // External repairs/settings are independent edits. Never undo across them.
  useEffect(() => {
    if (document !== lastOwnChange.current) {
      setHistory([]);
      editSession.current = null;
      lastOwnChange.current = document;
    }
  }, [document]);
  useEffect(() => {
    if (!focusNonce) return;
    const frame = requestAnimationFrame(() => editorRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusNonce]);
  const questions = document.pages.flatMap((p) => p.questions);
  const question = questions.find((q) => q.id === selected) ?? questions[0];
  const page =
    document.pages.find((p) => p.questions.some((q) => q.id === question.id)) ??
    document.pages[0];
  const pageIndex = document.pages.indexOf(page);
  const index = questions.indexOf(question);
  const indexOnPage = page.questions.indexOf(question);
  const locked = isRequiredSpecializedQuestion(document.type, question.id);
  const optionsLocked = locked && question.id === "success";
  const minOptions =
    document.type === "taskPriority" && question.id === "priority" ? 2 : 1;
  const summaries = useMemo(
    () => buildConditionSummaries(document),
    [document],
  );
  const issues = useMemo(() => findHandoffIssues(document), [document]);
  const plan = deleteId ? deletionPlan(questions, deleteId) : null;
  const protectedDeletion =
    plan &&
    questions.some(
      (q) =>
        plan.affected.has(q.id) &&
        isRequiredSpecializedQuestion(document.type, q.id),
    );
  const introCopy = useRef(
    document.intro ?? { title: "Velkommen", body: "", startLabel: "Start" },
  );
  function commit(next: SurveyDocumentV1, key?: string) {
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    if (!key || editSession.current !== key)
      setHistory((prev) => [
        ...prev.slice(-49),
        { document: current.current, selected, selectedScreen },
      ]);
    editSession.current = key ?? null;
    lastOwnChange.current = next;
    current.current = next;
    onChange(next);
    setError("");
  }
  function update(q: SurveyQuestionV1, key?: string) {
    commit(
      replaceQuestion(current.current, q),
      key ? `${q.id}:${key}` : undefined,
    );
  }
  function select(id: string) {
    setSelected(id);
    setSelectedScreen(null);
    setError("");
    editSession.current = null;
    setFocusNonce((n) => n + 1);
  }
  function undo() {
    const last = history.at(-1);
    if (!last) return;
    lastOwnChange.current = last.document;
    current.current = last.document;
    onChange(last.document);
    setSelected(last.selected);
    setSelectedScreen(last.selectedScreen);
    setHistory((prev) => prev.slice(0, -1));
    editSession.current = null;
    setError("");
    setNotice("Endringen er angret.");
    setFocusNonce((n) => n + 1);
  }
  function add(
    source?: SurveyQuestionV1,
    value?: string,
    condition?: SurveyQuestionV1["visibleIf"],
  ) {
    const nextQuestion = { ...createQuestion("text"), prompt: "" };
    if (condition) nextQuestion.visibleIf = condition;
    else if (source && value)
      nextQuestion.visibleIf = {
        questionId: source.id,
        operator: source.type === "multiChoice" ? "CONTAINS" : "EQ",
        value,
      };
    const sourcePage = source
      ? document.pages.find((p) => p.questions.some((q) => q.id === source.id))
      : undefined;
    commit(insertQuestionPage(document, nextQuestion, sourcePage?.id));
    select(nextQuestion.id);
    setNotice(
      source
        ? "Oppfølgingsspørsmålet er lagt til på en egen side for det valgte svaret."
        : "Spørsmålet er lagt til på en egen side.",
    );
  }
  function move(next: SurveyDocumentV1) {
    if (next === document) return;
    const conflict = orderConflict(next.pages.map((p) => p.questions));
    if (conflict) {
      setError(
        `Kan ikke flytte: spørsmål ${questions.indexOf(conflict.question) + 1} følger opp spørsmål ${questions.findIndex((q) => q.id === conflict.source) + 1} og må komme etter det. Ingen spørsmål er flyttet.`,
      );
      return;
    }
    commit(next);
    setNotice("Rekkefølgen er endret. Sidegrupper og svarregler er beholdt.");
  }
  function remove(id: string) {
    const p = deletionPlan(questions, id);
    if (
      p.blockers.length ||
      questions.some(
        (q) =>
          p.affected.has(q.id) &&
          isRequiredSpecializedQuestion(document.type, q.id),
      )
    )
      return;
    const next = deleteFromDocument(document, p.affected);
    commit(next);
    setDeleteId(null);
    const neighbor = questions
      .slice(
        0,
        questions.findIndex((q) => q.id === id),
      )
      .reverse()
      .find((q) => !p.affected.has(q.id));
    select(neighbor?.id ?? next.pages[0].questions[0].id);
    setNotice(
      p.dependents.length
        ? `Spørsmålet og ${p.dependents.length} oppfølgingsspørsmål er slettet. Du kan angre.`
        : "Spørsmålet er slettet. Du kan angre.",
    );
  }
  function requestDelete() {
    const p = deletionPlan(questions, question.id);
    if (locked) {
      setError("Spørsmålet brukes av analyseoppsettet og kan ikke slettes.");
      return;
    }
    if (p.dependents.length) setDeleteId(question.id);
    else remove(question.id);
  }
  function setType(type: QuestionTypeId) {
    if (type === question.type) return;
    const affected = questions.filter(
      (q) =>
        sources(q).includes(question.id) &&
        ruleLeaves(q).some((leaf) => leaf.operator !== "EXISTS"),
    );
    if (affected.length) {
      setError(
        `Spørsmål ${affected.map((q) => questions.indexOf(q) + 1).join(", ")} følger opp svaralternativer eller verdier her. Endre hvem de skal vises til før du bytter svartype.`,
      );
      return;
    }
    commit(changeQuestionType(document, page.id, question.id, type));
  }
  function optionAction(optionIndex: number, action: "up" | "down" | "delete") {
    if (!("options" in question)) return;
    const option = question.options[optionIndex];
    if (action === "delete") {
      const affected = questions.filter((q) =>
        ruleLeaves(q).some(
          (leaf) =>
            "questionId" in leaf &&
            leaf.questionId === question.id &&
            "value" in leaf &&
            leaf.value === option.value,
        ),
      );
      if (affected.length) {
        setError(
          `Spørsmål ${affected.map((q) => questions.indexOf(q) + 1).join(", ")} bruker dette svaret. Endre hvem de skal vises til før du sletter alternativet.`,
        );
        return;
      }
      const options = question.options.filter((_, i) => i !== optionIndex);
      update({
        ...question,
        options,
        ...(question.type === "multiChoice" &&
        question.maxSelections &&
        question.maxSelections > options.length
          ? { maxSelections: options.length }
          : {}),
      });
    } else {
      const options = [...question.options];
      const to = optionIndex + (action === "up" ? -1 : 1);
      [options[optionIndex], options[to]] = [options[to], options[optionIndex]];
      update({ ...question, options });
    }
  }
  const selectedPreview = useMemo(
    () => ({
      authoringSchemaVersion: 1 as const,
      pages: [
        {
          ...page,
          questions: page.questions.map(
            ({ visibleIf: _, ...q }) => q,
          ) as typeof page.questions,
        },
      ] as SurveyDocumentV1["pages"],
      success: document.success,
    }),
    [page, document.success],
  );
  // This isolated presentation copy never reaches onChange/save/share. It shows
  // every question on the selected page; the full run tests actual conditions.
  const previewDocument = mode === "try" ? document : selectedPreview;
  const previewError = useMemo(() => {
    try {
      validateSurveyDocumentV1(previewDocument);
      return null;
    } catch (e) {
      return e instanceof Error
        ? e.message
        : "Forhåndsvisningen kunne ikke åpnes.";
    }
  }, [previewDocument]);
  const screenValue =
    selectedScreen === "$intro" ? document.intro : document.success;
  function screenNav(
    id: "$intro" | "$success",
    title: string,
    description: string,
  ) {
    return (
      <section>
        <Heading size="xsmall" level="2">
          <Button
            className={styles.screenNav}
            icon={<ChevronRightIcon aria-hidden />}
            iconPosition="right"
            size="small"
            data-color="neutral"
            variant={selectedScreen === id ? "secondary" : "tertiary"}
            aria-current={selectedScreen === id ? "step" : undefined}
            onClick={() => {
              setSelectedScreen(id);
              setError("");
              editSession.current = null;
              setFocusNonce((n) => n + 1);
            }}
          >
            {title}
          </Button>
        </Heading>
        <Detail className={styles.screenDescription}>{description}</Detail>
      </section>
    );
  }
  const outline = (
    <nav className={styles.nav} aria-label="Spørsmål og sider i undersøkelsen">
      {screenNav(
        "$intro",
        "Velkomstside",
        document.intro ? "Før spørsmålene" : "Ikke i bruk",
      )}
      <section className={styles.questionGroup} aria-label="Spørsmål">
        <div className={styles.outlineHeading}>
          <Heading size="xsmall" level="2">
            Spørsmål
          </Heading>
          <Detail>
            {questions.length} spørsmål · {document.pages.length}{" "}
            {document.pages.length === 1 ? "spørsmålside" : "spørsmålsider"}
          </Detail>
        </div>
        {document.pages.map((p, pi) => (
          <section
            key={p.id}
            className={styles.pageGroup}
            aria-label={`Side ${pi + 1}`}
          >
            <HStack gap="space-4" justify="space-between" align="center">
              <Detail>
                Side {pi + 1} ·{" "}
                {p.questions.length === 1
                  ? "1 spørsmål"
                  : `${p.questions.length} spørsmål sammen`}
              </Detail>
              <HStack gap="space-0" wrap={false}>
                <Button
                  size="xsmall"
                  variant="tertiary"
                  data-color="neutral"
                  icon={<ArrowUpIcon aria-hidden />}
                  aria-label={`Flytt side ${pi + 1} opp`}
                  title="Flytt side opp"
                  disabled={pi === 0}
                  onClick={() => move(moveDocumentPage(document, p.id, -1))}
                />
                <Button
                  size="xsmall"
                  variant="tertiary"
                  data-color="neutral"
                  icon={<ArrowDownIcon aria-hidden />}
                  aria-label={`Flytt side ${pi + 1} ned`}
                  title="Flytt side ned"
                  disabled={pi === document.pages.length - 1}
                  onClick={() => move(moveDocumentPage(document, p.id, 1))}
                />
              </HStack>
            </HStack>
            {p.questions.map((q) => (
              <div key={q.id}>
                <Button
                  size="small"
                  className={styles.questionNav}
                  data-color="neutral"
                  variant={
                    !selectedScreen && selected === q.id
                      ? "secondary"
                      : "tertiary"
                  }
                  aria-current={
                    !selectedScreen && selected === q.id ? "step" : undefined
                  }
                  onClick={() => select(q.id)}
                >
                  Spørsmål {questions.indexOf(q) + 1} ·{" "}
                  {q.prompt || "Nytt spørsmål"}
                </Button>
                {q.visibleIf && (
                  <Detail className={styles.audienceHint}>
                    {summaries.get(q.id)}
                  </Detail>
                )}
              </div>
            ))}
          </section>
        ))}
        <VStack gap="space-4">
          <Button
            variant="tertiary"
            icon={<PlusIcon aria-hidden />}
            onClick={() => add()}
          >
            Legg til spørsmål
          </Button>
          <Detail>Vises til alle. Du kan begrense hvem som får det.</Detail>
        </VStack>
      </section>
      {screenNav("$success", "Takkeside", "Etter innsending")}
    </nav>
  );
  const editor = (
    <section
      ref={editorRef}
      tabIndex={-1}
      className={styles.panel}
      aria-label={
        selectedScreen
          ? selectedScreen === "$intro"
            ? "Rediger velkomstside"
            : "Rediger takkeside"
          : "Rediger spørsmål"
      }
    >
      <VStack gap="space-24">
        {selectedScreen ? (
          <>
            <Heading size="medium" level="2">
              {selectedScreen === "$intro"
                ? "Rediger velkomstside"
                : "Rediger takkeside"}
            </Heading>
            {selectedScreen === "$intro" ? (
              <Checkbox
                checked={Boolean(document.intro)}
                onChange={(event) => {
                  if (document.intro) introCopy.current = document.intro;
                  commit({
                    ...document,
                    intro: event.target.checked ? introCopy.current : undefined,
                  });
                }}
              >
                Vis velkomstside før spørsmålene
              </Checkbox>
            ) : (
              !document.success && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    commit({
                      ...document,
                      success: { title: "Takk for svaret", body: "" },
                    })
                  }
                >
                  Tilpass takkesiden
                </Button>
              )
            )}
            {screenValue ? (
              <>
                <TextField
                  label={`Tittel på ${selectedScreen === "$intro" ? "velkomstsiden" : "takkesiden"}`}
                  value={screenValue.title}
                  onChange={(e) =>
                    commit(
                      {
                        ...document,
                        [selectedScreen === "$intro" ? "intro" : "success"]: {
                          ...screenValue,
                          title: e.target.value,
                        },
                      },
                      `${selectedScreen}:title`,
                    )
                  }
                />
                <Textarea
                  label={`Tekst på ${selectedScreen === "$intro" ? "velkomstsiden" : "takkesiden"}`}
                  description="Valgfritt"
                  value={screenValue.body ?? ""}
                  onChange={(e) =>
                    commit(
                      {
                        ...document,
                        [selectedScreen === "$intro" ? "intro" : "success"]: {
                          ...screenValue,
                          body: e.target.value,
                        },
                      },
                      `${selectedScreen}:body`,
                    )
                  }
                />
                {selectedScreen === "$intro" && (
                  <TextField
                    label="Tekst på startknappen"
                    value={document.intro?.startLabel ?? ""}
                    placeholder="Start"
                    onChange={(e) => {
                      if (!document.intro) return;
                      commit(
                        {
                          ...document,
                          intro: {
                            ...document.intro,
                            startLabel: e.target.value.trim()
                              ? e.target.value
                              : undefined,
                          },
                        },
                        "intro:startLabel",
                      );
                    }}
                  />
                )}
              </>
            ) : (
              <BodyLong>
                {selectedScreen === "$intro"
                  ? "Undersøkelsen starter rett på første spørsmål."
                  : "Standard takkeside brukes. Du kan tilpasse teksten her."}
              </BodyLong>
            )}
          </>
        ) : (
          <>
            <HStack gap="space-12" justify="space-between" align="start">
              <div>
                <Detail>
                  SPØRSMÅL {index + 1} · SIDE {pageIndex + 1}
                  {page.questions.length > 1
                    ? ` · ${page.questions.length} SPØRSMÅL SAMMEN`
                    : ""}
                </Detail>
                <Heading size="medium" level="2">
                  Rediger spørsmålet
                </Heading>
              </div>
              <ActionMenu>
                <ActionMenu.Trigger>
                  <Button
                    size="small"
                    variant="secondary"
                    data-color="neutral"
                    icon={<ChevronDownIcon aria-hidden />}
                    iconPosition="right"
                  >
                    Handlinger
                  </Button>
                </ActionMenu.Trigger>
                <ActionMenu.Content align="end">
                  {page.questions.length > 1 && (
                    <ActionMenu.Group label="Rekkefølge på denne siden">
                      <ActionMenu.Item
                        disabled={indexOnPage === 0}
                        onSelect={() =>
                          move(moveDocumentQuestion(document, question.id, -1))
                        }
                      >
                        Flytt spørsmål opp
                      </ActionMenu.Item>
                      <ActionMenu.Item
                        disabled={indexOnPage === page.questions.length - 1}
                        onSelect={() =>
                          move(moveDocumentQuestion(document, question.id, 1))
                        }
                      >
                        Flytt spørsmål ned
                      </ActionMenu.Item>
                    </ActionMenu.Group>
                  )}
                  <ActionMenu.Item
                    variant="danger"
                    icon={<TrashIcon aria-hidden />}
                    onSelect={requestDelete}
                  >
                    Slett spørsmål
                  </ActionMenu.Item>
                </ActionMenu.Content>
              </ActionMenu>
            </HStack>
            <Textarea
              label="Spørsmålstekst"
              minRows={2}
              value={question.prompt}
              onChange={(e) =>
                update({ ...question, prompt: e.target.value }, "prompt")
              }
            />
            {locked ? (
              <Detail>
                Svartype og påkrevde innstillinger brukes av analyseoppsettet.
                Spørsmålsteksten kan redigeres.
              </Detail>
            ) : (
              <Select
                label="Hvordan skal de svare?"
                value={question.type}
                onChange={(e) => setType(e.target.value as QuestionTypeId)}
              >
                <option value="singleChoice">Velg ett svar</option>
                <option value="multiChoice">Velg flere svar</option>
                <option value="text">Skriv et svar</option>
                <option value="rating">Gi en vurdering</option>
              </Select>
            )}
            <Checkbox
              checked={Boolean(question.required)}
              disabled={locked}
              onChange={(e) =>
                update({ ...question, required: e.target.checked })
              }
            >
              Må besvares
            </Checkbox>
            <QuestionAudience
              key={`audience-${question.id}`}
              document={document}
              question={question}
              locked={locked}
              onChange={update}
            />
            {question.type === "rating" && (
              <VStack gap="space-8" align="start">
                <Heading size="xsmall" level="3">
                  Legg til oppfølgingsspørsmål
                </Heading>
                <BodyShort size="small">
                  Velg hvilke vurderinger du vil følge opp. Spørsmålet får en
                  egen side.
                </BodyShort>
                {followUpBranches(question).map((branch) => (
                  <Button
                    key={branch.key}
                    size="small"
                    variant="tertiary"
                    icon={<PlusIcon aria-hidden />}
                    onClick={() =>
                      add(question, undefined, branch.condition(question.id))
                    }
                  >
                    {branch.label}
                  </Button>
                ))}
              </VStack>
            )}
            {"options" in question && (
              <VStack gap="space-12">
                <Heading size="xsmall" level="3">
                  Svaralternativer
                </Heading>
                <BodyShort size="small">
                  Et oppfølgingsspørsmål vises bare når svaret det hører til, er
                  valgt.
                </BodyShort>
                {question.options.map((option, oi) => (
                  <div className={styles.optionRow} key={option.value}>
                    <Textarea
                      label={`Alternativ ${oi + 1}`}
                      minRows={1}
                      maxRows={4}
                      value={option.label}
                      onChange={(e) =>
                        update(
                          {
                            ...question,
                            options: question.options.map((o, i) =>
                              i === oi ? { ...o, label: e.target.value } : o,
                            ),
                          },
                          `option:${option.value}`,
                        )
                      }
                      onBlur={(e) =>
                        commit(
                          commitOptionLabel(
                            current.current,
                            page.id,
                            question.id,
                            oi,
                            e.target.value,
                          ),
                        )
                      }
                    />
                    <HStack gap="space-4" justify="space-between">
                      <Button
                        size="small"
                        variant="tertiary"
                        icon={<PlusIcon aria-hidden />}
                        disabled={
                          !option.label.trim() ||
                          isSurveyTemplatePlaceholderValue(option.value)
                        }
                        aria-label={`Legg til oppfølgingsspørsmål for: ${option.label || "svaralternativet"}`}
                        onClick={() => add(question, option.value)}
                      >
                        Legg til oppfølgingsspørsmål
                      </Button>
                      {!optionsLocked && (
                        <ActionMenu>
                          <ActionMenu.Trigger>
                            <Button
                              size="small"
                              variant="tertiary"
                              data-color="neutral"
                              icon={<ChevronDownIcon aria-hidden />}
                              aria-label={`Handlinger for alternativ ${oi + 1}`}
                            />
                          </ActionMenu.Trigger>
                          <ActionMenu.Content>
                            <ActionMenu.Item
                              disabled={oi === 0}
                              onSelect={() => optionAction(oi, "up")}
                            >
                              Flytt alternativ opp
                            </ActionMenu.Item>
                            <ActionMenu.Item
                              disabled={oi === question.options.length - 1}
                              onSelect={() => optionAction(oi, "down")}
                            >
                              Flytt alternativ ned
                            </ActionMenu.Item>
                            <ActionMenu.Item
                              disabled={question.options.length <= minOptions}
                              variant="danger"
                              onSelect={() => optionAction(oi, "delete")}
                            >
                              Slett alternativ
                            </ActionMenu.Item>
                          </ActionMenu.Content>
                        </ActionMenu>
                      )}
                    </HStack>
                  </div>
                ))}
                {!optionsLocked && (
                  <Button
                    variant="tertiary"
                    icon={<PlusIcon aria-hidden />}
                    onClick={() =>
                      update({
                        ...question,
                        options: [
                          ...question.options,
                          {
                            value: `alternativ-${crypto.randomUUID()}`,
                            label: "",
                          },
                        ],
                      })
                    }
                  >
                    Legg til svaralternativ
                  </Button>
                )}
                {question.type === "multiChoice" && (
                  <TextField
                    label="Hvor mange svar kan de velge?"
                    description={
                      locked
                        ? "Velg hvor mange oppgaver de kan velge."
                        : "La stå tomt hvis de kan velge så mange de vil."
                    }
                    type="number"
                    min={1}
                    max={question.options.length}
                    value={question.maxSelections ?? ""}
                    error={
                      locked && question.maxSelections === undefined
                        ? "Velg hvor mange oppgaver de kan velge."
                        : question.maxSelections !== undefined &&
                            (!Number.isInteger(question.maxSelections) ||
                              question.maxSelections < 1 ||
                              question.maxSelections > question.options.length)
                          ? "Velg et helt antall fra 1 til antallet svaralternativer."
                          : undefined
                    }
                    onChange={(e) =>
                      update(
                        {
                          ...question,
                          maxSelections: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        },
                        "maxSelections",
                      )
                    }
                  />
                )}
              </VStack>
            )}
            {question.type === "rating" && !locked && (
              <Select
                label="Vurderingsskala"
                value={question.variant ?? "emoji"}
                onChange={(e) => {
                  if (questions.some((q) => sources(q).includes(question.id))) {
                    setError(
                      "Andre spørsmål bruker denne vurderingen. Tilpass oppfølgingsspørsmålene før du endrer skalaen.",
                    );
                    return;
                  }
                  update({
                    ...question,
                    variant: e.target.value as typeof question.variant,
                  });
                }}
              >
                <option value="emoji">Smilefjes</option>
                <option value="stars">Stjerner</option>
                <option value="thumbs">Tommel opp eller ned</option>
                <option value="nps">0 til 10</option>
              </Select>
            )}
            {questions.length > 1 && (
              <RadioGroup
                legend="Hvor skal det vises?"
                value={
                  page.questions.length === 1
                    ? "new"
                    : indexOnPage === 0
                      ? "group"
                      : "same"
                }
                onChange={(v) => {
                  try {
                    commit(placeQuestion(document, question.id, v === "same"));
                    setNotice(
                      "Sideplasseringen er endret. Svarregelen er beholdt.",
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Spørsmålet kunne ikke flyttes.",
                    );
                  }
                }}
              >
                <Radio value="new">På en egen side</Radio>
                {index > 0 && (
                  <Radio value="same">Sammen med spørsmål {index}</Radio>
                )}
                {indexOnPage === 0 && page.questions.length > 1 && (
                  <Radio value="group">
                    Sammen med de andre spørsmålene på siden
                  </Radio>
                )}
              </RadioGroup>
            )}
            <details key={`settings-${question.id}`}>
              <summary>Hjelpetekst og flere innstillinger</summary>
              <VStack gap="space-16">
                <Textarea
                  label="Hjelpetekst"
                  value={question.description ?? ""}
                  onChange={(e) =>
                    update(
                      { ...question, description: e.target.value },
                      "description",
                    )
                  }
                />
                {question.type === "text" && (
                  <TextField
                    type="number"
                    min={1}
                    label="Maks antall tegn"
                    value={question.maxLength ?? ""}
                    onChange={(e) =>
                      update(
                        {
                          ...question,
                          maxLength: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        },
                        "maxLength",
                      )
                    }
                  />
                )}
                <TextField
                  label="Felles overskrift på siden"
                  description="Valgfritt. Brukes for alle spørsmål som vises på denne siden."
                  value={page.title ?? ""}
                  onChange={(e) =>
                    commit(
                      {
                        ...document,
                        pages: document.pages.map((p) =>
                          p.id === page.id
                            ? { ...p, title: e.target.value }
                            : p,
                        ) as SurveyDocumentV1["pages"],
                      },
                      `${page.id}:title`,
                    )
                  }
                />
                <Textarea
                  label="Felles hjelpetekst på siden"
                  value={page.description ?? ""}
                  onChange={(e) =>
                    commit(
                      {
                        ...document,
                        pages: document.pages.map((p) =>
                          p.id === page.id
                            ? { ...p, description: e.target.value }
                            : p,
                        ) as SurveyDocumentV1["pages"],
                      },
                      `${page.id}:description`,
                    )
                  }
                />
              </VStack>
            </details>
            <VStack gap="space-4" align="start">
              <Button
                variant="secondary"
                icon={<PlusIcon aria-hidden />}
                onClick={() => add()}
              >
                Legg til spørsmål
              </Button>
              <Detail>Vises til alle. Du kan begrense hvem som får det.</Detail>
            </VStack>
          </>
        )}
      </VStack>
    </section>
  );
  const preview = (
    <section
      className={`${styles.panel} ${styles.previewPanel}`}
      aria-label="Forhåndsvisning"
    >
      <VStack gap="space-16">
        <HStack justify="space-between" gap="space-8">
          <Heading size="small" level="2">
            {mode === "try"
              ? "Prøv som respondent"
              : selectedScreen
                ? "Forhåndsvisning"
                : "Forhåndsvis valgt side"}
          </Heading>
          {mode === "try" && (
            <Button
              size="small"
              variant="tertiary"
              onClick={() => {
                setSkipIntro(false);
                setRestart((n) => n + 1);
              }}
            >
              Start på nytt
            </Button>
          )}
        </HStack>
        <Detail>
          {mode === "try"
            ? "Ingen svar sendes. Prøv også å gå tilbake og endre svar."
            : selectedScreen
              ? "Slik blir teksten på siden."
              : "Viser alle spørsmålene på denne siden. Prøv hele undersøkelsen for å kontrollere hvem som får dem."}
        </Detail>
        {mode === "build" && selectedScreen ? (
          <VStack gap="space-16">
            <Heading size="medium" level="3">
              {screenValue?.title ||
                (selectedScreen === "$intro"
                  ? "Ingen velkomstside"
                  : "Takk for svaret")}
            </Heading>
            <BodyLong className={styles.screenBody}>
              {screenValue?.body}
            </BodyLong>
            {selectedScreen === "$intro" && document.intro && (
              <Button
                onClick={() => {
                  setMode("try");
                  setSkipIntro(true);
                  setRestart((n) => n + 1);
                }}
              >
                {document.intro.startLabel?.trim() || "Start"}
              </Button>
            )}
          </VStack>
        ) : previewError ? (
          <Alert variant="info">{previewError}</Alert>
        ) : (
          <StageSurface
            roomy
            document={previewDocument}
            instanceKey={JSON.stringify(previewDocument)}
            nonce={restart}
            surveyId={`verksted-preview-${surveyId}`}
            environmentTag="survey-workshop-editor"
            initialPageId={
              mode === "build"
                ? page.id
                : skipIntro
                  ? document.pages[0].id
                  : undefined
            }
            showProgress={mode === "try"}
            successTitle="Takk for svaret"
            successBody="Ingen svar ble sendt."
          />
        )}
      </VStack>
    </section>
  );
  return (
    <div
      className={styles.root}
      onBlurCapture={() => {
        editSession.current = null;
      }}
    >
      <HStack gap="space-12" justify="space-between" align="center">
        <BodyShort>
          {questions.length} spørsmål · {document.pages.length}{" "}
          {document.pages.length === 1 ? "side" : "sider"} i oppsettet ·
          Respondenten får bare relevante sider
        </BodyShort>
        <HStack gap="space-8">
          <Button variant="tertiary" disabled={!history.length} onClick={undo}>
            Angre
          </Button>
          <Button
            variant="secondary"
            icon={
              mode === "build" ? (
                <EyeIcon aria-hidden />
              ) : (
                <ArrowLeftIcon aria-hidden />
              )
            }
            onClick={() => {
              setMode(mode === "build" ? "try" : "build");
              setSkipIntro(false);
              setRestart((n) => n + 1);
            }}
          >
            {mode === "build"
              ? "Prøv hele undersøkelsen"
              : "Tilbake til bygging"}
          </Button>
        </HStack>
      </HStack>
      {error && (
        <Alert variant="warning" role="alert">
          {error}
        </Alert>
      )}
      {notice && (
        <HStack gap="space-8" align="center">
          <BodyShort role="status">{notice}</BodyShort>
          {history.length > 0 && (
            <Button size="small" variant="tertiary" onClick={undo}>
              Angre siste endring
            </Button>
          )}
        </HStack>
      )}
      {mode === "build" && issues.length > 0 && (
        <details>
          <summary>
            {issues.length} {issues.length === 1 ? "punkt" : "punkter"} må
            fullføres før deling
          </summary>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.questionId ?? "survey"}:${issue.message}`}>
                {issue.questionId ? (
                  <Button
                    variant="tertiary"
                    size="small"
                    onClick={() => {
                      if (issue.questionId) select(issue.questionId);
                    }}
                  >
                    {issue.message}
                  </Button>
                ) : (
                  issue.message
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {mode === "try" ? (
        <div className={styles.previewOnly}>{preview}</div>
      ) : (
        <div className={styles.listLayout}>
          <div className={styles.outlineArea}>
            <details className={styles.mobileOutline}>
              <summary>Spørsmål og sider</summary>
              {outline}
            </details>
            <div className={styles.desktopOutline}>{outline}</div>
          </div>
          {editor}
          {preview}
        </div>
      )}
      <details>
        <summary>Avanserte innstillinger</summary>
        <BodyShort size="small">
          Her kan du redigere tekniske verdier og øvrige innstillinger som ikke
          vises i den enkle editoren.
        </BodyShort>
        <Button variant="secondary" onClick={onAdvanced}>
          Åpne avansert redigering
        </Button>
      </details>
      <Modal
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        width="medium"
        header={{ heading: "Slett spørsmål med oppfølginger?" }}
      >
        <Modal.Body>
          <VStack gap="space-16">
            <BodyLong>
              {questions.find((q) => q.id === deleteId)?.prompt}
            </BodyLong>
            <BodyLong>Disse oppfølgingsspørsmålene berøres:</BodyLong>
            <ul>
              {plan?.dependents.map((q) => (
                <li key={q.id}>
                  Spørsmål {questions.indexOf(q) + 1} ·{" "}
                  {q.prompt || "Uten spørsmålstekst"}
                </li>
              ))}
            </ul>
            {protectedDeletion || plan?.blockers.length ? (
              <Alert variant="warning">
                Spørsmålene brukes av analyseoppsettet eller har flere kilder
                eller en tilpasset svarregel. Tilpass dem i avansert redigering
                før du sletter. Ingen spørsmål er slettet.
              </Alert>
            ) : (
              <BodyLong>
                Oppfølgingsspørsmålene slettes sammen med spørsmålet. Du kan
                angre etterpå. Hvis alle spørsmål slettes, får du et tomt første
                spørsmål å begynne på.
              </BodyLong>
            )}
          </VStack>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            Avbryt
          </Button>
          {!protectedDeletion && !plan?.blockers.length && (
            <Button
              data-color="danger"
              onClick={() => deleteId && remove(deleteId)}
            >
              Slett spørsmålet og {plan?.dependents.length} oppfølgingsspørsmål
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}
