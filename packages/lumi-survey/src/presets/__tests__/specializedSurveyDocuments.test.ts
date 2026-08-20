import { describe, expect, it } from "vitest";
import { validateSurveyDocumentV1 } from "../../components/shared/canonicalSurvey";
import {
  buildTransportPayload,
  inferSurveyType,
} from "../../core/transportPayload";
import type { LumiSurveyQuestion } from "../../core/types";
import type { RatingSurveyDocumentOptions } from "../../index";
import {
  createDiscoverySurvey,
  createDiscoverySurveyDocument,
  createRatingSurveyDocument,
  createTaskPrioritySurvey,
  createTaskPrioritySurveyDocument,
  createTopTasksSurvey,
  createTopTasksSurveyDocument,
} from "../index";

const tasks = [
  { value: "apply", label: "Søke" },
  { value: "status", label: "Sjekke status" },
];

function questionsFromPages(
  pages: ReturnType<typeof createDiscoverySurveyDocument>["pages"],
): LumiSurveyQuestion[] {
  return pages.flatMap((page) => page.questions) as LumiSurveyQuestion[];
}

describe("specialized survey contracts", () => {
  it("exports the recommended rating options from the package root", () => {
    const options = {
      ratingPrompt: "Hvordan gikk det?",
      variant: "thumbs",
    } satisfies RatingSurveyDocumentOptions;
    expect(
      createRatingSurveyDocument(options).pages[0].questions[0],
    ).toMatchObject({ variant: "thumbs" });
  });
  it("creates a page-based rating document with progressive follow-ups", () => {
    const document = createRatingSurveyDocument({
      ratingPrompt: "Hvordan gikk det?",
      followUpQuestions: [
        {
          id: "reason",
          type: "text",
          prompt: "Fortell mer",
        },
      ],
    });

    expect(document.pages).toHaveLength(1);
    expect(document.pages[0].questions[1]).toMatchObject({
      id: "reason",
      visibleIf: {
        questionId: "rating",
        operator: "EXISTS",
      },
    });
    expect(validateSurveyDocumentV1(document)).toBe(document);
  });

  it.each([
    "emoji",
    "thumbs",
    "stars",
  ] as const)("creates a %s rating document", (variant) => {
    const document = createRatingSurveyDocument({
      ratingPrompt: "Hvordan gikk det?",
      variant,
    });
    expect(document.pages[0].questions[0]).toMatchObject({ variant });
    expect(validateSurveyDocumentV1(document)).toBe(document);
  });

  it("creates an NPS document with endpoint labels", () => {
    const document = createRatingSurveyDocument({
      ratingPrompt: "Hvor sannsynlig er det at du anbefaler oss?",
      variant: "nps",
      lowLabel: "Lite sannsynlig",
      highLabel: "Svært sannsynlig",
    });
    expect(document.pages[0].questions[0]).toMatchObject({
      variant: "nps",
      lowLabel: "Lite sannsynlig",
      highLabel: "Svært sannsynlig",
    });
  });

  it.each([
    {
      name: "discovery",
      document: createDiscoverySurveyDocument(),
      expectedIds: ["task", "success", "blocker"],
    },
    {
      name: "top tasks",
      document: createTopTasksSurveyDocument({ tasks }),
      expectedIds: ["task", "success", "blocker"],
    },
    {
      name: "task priority",
      document: createTaskPrioritySurveyDocument({ tasks }),
      expectedIds: ["priority"],
    },
  ])("creates a valid page-based $name document", ({
    document,
    expectedIds,
  }) => {
    expect(validateSurveyDocumentV1(document)).toBe(document);
    expect(document.pages.map((page) => page.id)).toEqual(expectedIds);
    expect(
      questionsFromPages(document.pages).map((question) => question.id),
    ).toEqual(expectedIds);
  });

  it.each([
    [createDiscoverySurvey(), ["discoveredTask", "taskSuccess", "blocker"]],
    [createTopTasksSurvey({ tasks }), ["task", "taskSuccess", "blocker"]],
    [createTaskPrioritySurvey({ tasks }), ["priorities"]],
  ])("preserves the 2.0.1 field IDs from a deprecated builder", (survey, ids) => {
    expect(survey.questions.map((question) => question.id)).toEqual(ids);
  });

  it("still transports a deprecated Discovery config", () => {
    const survey = createDiscoverySurvey();
    expect(() =>
      buildTransportPayload(
        "legacy-discovery",
        {
          discoveredTask: "Søke om sykepenger",
          taskSuccess: "yes",
        },
        survey.questions,
        "1234567890abcdef",
        survey.type,
        undefined,
        undefined,
        "2026-08-20T12:00:00Z",
      ),
    ).not.toThrow();
  });

  it("keeps a one-option deprecated Task Priority survey transport-compatible", () => {
    const survey = createTaskPrioritySurvey({
      tasks: [{ value: "apply", label: "Søke" }],
      maxSelections: 5,
    });
    const payload = buildTransportPayload(
      "legacy-priority",
      { priorities: ["apply"] },
      survey.questions,
      "1234567890abcdef",
      survey.type,
      undefined,
      undefined,
      "2026-08-20T12:00:00Z",
    );
    expect(payload.definition.fields[0]).toMatchObject({ maxSelections: 1 });
  });

  it("never infers specialized analytics from ordinary custom field names", () => {
    expect(
      inferSurveyType([
        {
          id: "task",
          type: "text",
          prompt: "Oppgave",
          required: true,
        },
        {
          id: "success",
          type: "singleChoice",
          prompt: "Resultat",
          required: true,
          options: [{ value: "done", label: "Ferdig" }],
        },
      ]),
    ).toBe("custom");
    expect(
      inferSurveyType([
        {
          id: "priority",
          type: "multiChoice",
          prompt: "Prioritet",
          options: [{ value: "one", label: "Én" }],
        },
      ]),
    ).toBe("custom");
  });

  it("rejects empty, blank and duplicate task lists at the builder boundary", () => {
    expect(() => createTopTasksSurveyDocument({ tasks: [] })).toThrow(
      "Top Tasks needs at least one task",
    );
    expect(() =>
      createTaskPrioritySurveyDocument({
        tasks: [{ value: " ", label: "Oppgave" }],
      }),
    ).toThrow("tasks need a non-blank value and label");
    expect(() =>
      createTopTasksSurveyDocument({
        tasks: [
          { value: "same", label: "Første" },
          { value: "same", label: "Andre" },
        ],
      }),
    ).toThrow("task values must be unique");
    expect(() =>
      createTopTasksSurveyDocument({
        tasks: [{ value: "other", label: "Noe annet" }],
        includeOtherTask: true,
      }),
    ).toThrow('reserves the task value "other"');
    expect(() =>
      createTaskPrioritySurveyDocument({ tasks, maxSelections: 0 }),
    ).toThrow("maxSelections must be a positive integer");
    expect(() =>
      createTaskPrioritySurveyDocument({
        tasks: [{ value: "one", label: "Én oppgave" }],
      }),
    ).toThrow("requires at least two tasks");
    expect(() =>
      createTaskPrioritySurveyDocument({ tasks, maxSelections: 3 }),
    ).toThrow("maxSelections cannot exceed the number of tasks");
  });

  it("uses a neutral Task Priority prompt and a truthful limit", () => {
    const document = createTaskPrioritySurveyDocument({ tasks });
    const [question] = questionsFromPages(document.pages);

    expect(question.prompt).toBe("Hvilke oppgaver er viktigst for deg?");
    expect(question).toMatchObject({ maxSelections: 2 });
  });

  it("rejects an unusable Task Priority selection rule", () => {
    const document = createTaskPrioritySurveyDocument({ tasks });
    const questions = questionsFromPages(document.pages);
    const priority = questions[0];
    if (priority.type !== "multiChoice") {
      throw new Error("missing priority question");
    }

    priority.maxSelections = 3;
    expect(() =>
      buildTransportPayload(
        "priority-test",
        { priority: ["apply"] },
        questions,
        "1234567890abcdef",
        document.type,
        undefined,
        undefined,
        "2026-08-20T12:00:00Z",
      ),
    ).toThrow("må være mellom 1 og antallet oppgaver");
  });

  it("builds the exact Discovery payload consumed by analytics", () => {
    const document = createDiscoverySurveyDocument();
    const questions = questionsFromPages(document.pages);
    const payload = buildTransportPayload(
      "discovery-test",
      {
        task: "Søke om sykepenger",
        success: "partial",
        blocker: "Fant ikke riktig skjema",
      },
      questions,
      "1234567890abcdef",
      document.type,
      undefined,
      undefined,
      "2026-08-20T12:00:00Z",
    );

    expect(payload.surveyType).toBe("discovery");
    expect(
      payload.answers.map((answer) => [answer.fieldId, answer.fieldType]),
    ).toEqual([
      ["task", "TEXT"],
      ["success", "SINGLE_CHOICE"],
      ["blocker", "TEXT"],
    ]);
    expect(payload.definition.fields.map((field) => field.fieldId)).toEqual([
      "task",
      "success",
      "blocker",
    ]);
  });

  it("refuses transport when a required analytics answer is missing", () => {
    const document = createDiscoverySurveyDocument();
    const questions = questionsFromPages(document.pages);

    expect(() =>
      buildTransportPayload(
        "discovery-test",
        { task: "Søke om sykepenger" },
        questions,
        "1234567890abcdef",
        document.type,
        undefined,
        undefined,
        "2026-08-20T12:00:00Z",
      ),
    ).toThrow(
      "Lumi: Oppsettet «Hva kom brukeren for å gjøre?» trenger spørsmålet «success».",
    );
  });

  it("refuses an extra outcome and a repurposed blocker field", () => {
    const document = createTopTasksSurveyDocument({ tasks });
    const questions = questionsFromPages(document.pages);
    const success = questions.find((question) => question.id === "success");
    const blocker = questions.find((question) => question.id === "blocker");
    if (!success || success.type !== "singleChoice" || !blocker) {
      throw new Error("missing contract questions");
    }
    success.options.push({ value: "unknown", label: "Vet ikke" });

    expect(() =>
      buildTransportPayload(
        "top-tasks-test",
        { task: "apply", success: "yes" },
        questions,
        "1234567890abcdef",
        document.type,
        undefined,
        undefined,
        "2026-08-20T12:00:00Z",
      ),
    ).toThrow("må ha nøyaktig svarene Ja, Delvis og Nei");

    success.options.pop();
    Object.assign(blocker, {
      type: "singleChoice",
      options: [{ value: "other", label: "Annet" }],
    });
    expect(() =>
      buildTransportPayload(
        "top-tasks-test",
        { task: "apply", success: "yes" },
        questions,
        "1234567890abcdef",
        document.type,
        undefined,
        undefined,
        "2026-08-20T12:00:00Z",
      ),
    ).toThrow("Spørsmålet «blocker» har feil type");
  });

  it("requires contract questions to be mandatory, unconditional and unique", () => {
    const document = createDiscoverySurveyDocument();
    const questions = questionsFromPages(document.pages);
    const success = questions.find((question) => question.id === "success");
    if (!success || success.type !== "singleChoice") {
      throw new Error("missing success question");
    }

    success.required = false;
    expect(() =>
      buildTransportPayload(
        "discovery-test",
        { task: "Søke", success: "yes" },
        questions,
        "1234567890abcdef",
        document.type,
        undefined,
        undefined,
        "2026-08-20T12:00:00Z",
      ),
    ).toThrow("må være merket «Må besvares»");

    success.required = true;
    success.visibleIf = { questionId: "task", operator: "EXISTS" };
    expect(() =>
      buildTransportPayload(
        "discovery-test",
        { task: "Søke", success: "yes" },
        questions,
        "1234567890abcdef",
        document.type,
        undefined,
        undefined,
        "2026-08-20T12:00:00Z",
      ),
    ).toThrow("må alltid vises");

    delete success.visibleIf;
    success.options = [
      { value: "yes", label: "Ja" },
      { value: "yes", label: "Ja igjen" },
      { value: "partial", label: "Delvis" },
    ];
    expect(() =>
      buildTransportPayload(
        "discovery-test",
        { task: "Søke", success: "yes" },
        questions,
        "1234567890abcdef",
        document.type,
        undefined,
        undefined,
        "2026-08-20T12:00:00Z",
      ),
    ).toThrow("må ha nøyaktig svarene");
  });
});
