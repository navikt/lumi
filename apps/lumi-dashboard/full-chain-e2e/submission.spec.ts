import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  LumiApiFeedbackSubmissionV1,
  LumiApiFeedbackSubmissionV2,
} from "@navikt/lumi-survey";
import {
  expect,
  type Locator,
  type Page,
  type Response,
  type TestInfo,
  test,
} from "@playwright/test";

const DEMO_URL = process.env.LUMI_DEMO_URL ?? "http://127.0.0.1:3001";
const DASHBOARD_URL = process.env.LUMI_DASHBOARD_URL ?? "http://127.0.0.1:3000";

interface FullChainReport {
  schemaVersion: number;
  profileVersion: number;
  profile: string;
  runId: string;
  environment: string;
  generatedAt: string;
  startedAt: string;
  finishedAt: string | null;
  outcome: "pending" | "passed" | "failed";
  subject: { surveyId: string; team: string; app: string };
  observeAfter: string | null;
  checks: Array<{
    id: string;
    status: "pending" | "passed" | "failed";
    completedAt: string | null;
    detail: string;
  }>;
  probes: Record<string, unknown>;
  coverage: {
    controlledRoundTrip: "pending" | "passed" | "failed";
    localSubmissionProxy: "not-tested" | "passed" | "failed";
    surveyContractMatrix?: "not-tested" | "passed" | "failed";
    legacyCompatibility?: "passed" | "failed";
    globalAzureHealth: "not-assessed";
    trygdeetatenProxy: "not-tested";
    navWideRelease: "pending";
  };
  automation?: {
    runner: "playwright";
    failures: string[];
    matrix: MatrixScenarioEvidence[];
    legacyCompatibility: LegacyCompatibilityEvidence;
  };
}

interface TransportFieldDefinition {
  fieldId: string;
  fieldType: "RATING" | "TEXT" | "SINGLE_CHOICE" | "MULTI_CHOICE";
  ratingVariant?: "emoji" | "thumbs" | "stars" | "nps";
  ratingScale?: number;
  maxSelections?: number;
}

interface TransportAnswer {
  fieldId: string;
  fieldType: TransportFieldDefinition["fieldType"];
  value: {
    type: "rating" | "text" | "singleChoice" | "multiChoice";
    rating?: number;
    ratingVariant?: "emoji" | "thumbs" | "stars" | "nps";
    ratingScale?: number;
    text?: string;
    selectedOptionId?: string;
    selectedOptionIds?: string[];
  };
}

type MatrixAction =
  | { kind: "radio"; name: string | RegExp }
  | { kind: "textbox"; name: string; suffix: string }
  | { kind: "checkbox"; name: string }
  | { kind: "combobox"; name: string; options: string[] }
  | { kind: "next" };

interface MatrixScenario {
  id: string;
  authoringFormat: "legacy-flat" | "document-v1";
  surveyType: "rating" | "topTasks" | "discovery" | "taskPriority" | "custom";
  dashboardType:
    | "Vurdering"
    | "Top Tasks"
    | "Discovery"
    | "Task Priority"
    | "Custom";
  facets: string[];
  actions: MatrixAction[];
  fields: TransportFieldDefinition[];
  expectedAnswers: (marker: string) => TransportAnswer[];
  dashboardValues: (marker: string) => string[];
}

interface MatrixScenarioEvidence {
  scenarioId: string;
  surveyId: string;
  surveyType: MatrixScenario["surveyType"];
  authoringFormat: MatrixScenario["authoringFormat"];
  facets: string[];
  status: "passed" | "failed";
  receiptId: string | null;
  detail: string;
}

interface LegacySubmissionEvidence {
  schemaVersion: 1 | 2;
  receiptId: string | null;
  marker: string | null;
  readback: "not-tested" | "passed" | "failed";
}

interface LegacyCompatibilityEvidence {
  scenarioId: "legacy-flat-rating";
  surveyId: string;
  status: "passed" | "failed";
  legacySubmission: LegacySubmissionEvidence & { schemaVersion: 1 };
  widgetSubmission: LegacySubmissionEvidence & { schemaVersion: 2 };
  detail: string;
}

interface LocalSurveyMatrixResult {
  matrix: MatrixScenarioEvidence[];
  legacyCompatibility: LegacyCompatibilityEvidence;
}

interface CurrentWidgetSubmission {
  receiptId: string;
  response: Response;
}

class MatrixScenarioFailure extends Error {
  constructor(
    message: string,
    readonly receiptId: string | null,
  ) {
    super(message);
    this.name = "MatrixScenarioFailure";
  }
}

class LegacyCompatibilityFailure extends MatrixScenarioFailure {
  constructor(
    message: string,
    readonly legacyReceiptId: string | null,
    widgetReceiptId: string | null,
    readonly legacyMarker: string,
    readonly widgetMarker: string,
    readonly legacyReadback: "not-tested" | "passed" | "failed",
    readonly widgetReadback: "not-tested" | "passed" | "failed",
  ) {
    super(message, widgetReceiptId);
    this.name = "LegacyCompatibilityFailure";
  }
}

const TASK_OPTIONS = [
  "apply",
  "status",
  "message",
  "document",
  "payment",
  "change",
];

const MATRIX_SCENARIOS: MatrixScenario[] = [
  ratingScenario({
    id: "rating-emoji",
    facet: "emoji",
    ratingFieldId: "rating",
    ratingAction: { kind: "radio", name: "4. Bra" },
    rating: 4,
    textFieldId: "feedback",
    textPrompt: "Har du andre tilbakemeldinger?",
  }),
  ratingScenario({
    id: "legacy-flat-rating",
    authoringFormat: "legacy-flat",
    facet: "emoji",
    ratingFieldId: "rating",
    ratingAction: { kind: "radio", name: "4. Bra" },
    rating: 4,
    textFieldId: "feedback",
    textPrompt: "Hva bør vi forbedre?",
  }),
  ratingScenario({
    id: "rating-thumbs",
    facet: "thumbs",
    ratingFieldId: "helpful",
    ratingAction: { kind: "radio", name: "Ja, tommel opp" },
    rating: 2,
    textFieldId: "feedback",
    textPrompt: "Har du forslag til forbedringer?",
  }),
  ratingScenario({
    id: "rating-stars",
    facet: "stars",
    ratingFieldId: "stars",
    ratingAction: {
      kind: "radio",
      name: "4 av 5 stjerner. Bra",
    },
    rating: 4,
    textFieldId: "feedback",
    textPrompt: "Legg gjerne til en begrunnelse",
  }),
  ratingScenario({
    id: "rating-nps",
    facet: "nps",
    ratingFieldId: "nps",
    ratingAction: { kind: "radio", name: "8 av 10" },
    rating: 8,
    textFieldId: "reason",
    textPrompt: "Legg gjerne til en begrunnelse",
  }),
  {
    id: "discovery",
    authoringFormat: "document-v1",
    surveyType: "discovery",
    dashboardType: "Discovery",
    facets: ["text", "singleChoice", "pages", "visibleIf"],
    actions: [
      {
        kind: "textbox",
        name: "Hva kom du hit for å gjøre i dag?",
        suffix: "-task",
      },
      { kind: "next" },
      { kind: "radio", name: "Delvis" },
      { kind: "next" },
      { kind: "textbox", name: "Hva hindret deg?", suffix: "-blocker" },
    ],
    fields: [
      { fieldId: "task", fieldType: "TEXT" },
      { fieldId: "success", fieldType: "SINGLE_CHOICE" },
      { fieldId: "blocker", fieldType: "TEXT" },
    ],
    expectedAnswers: (marker) => [
      textAnswer("task", `${marker}-task`),
      singleChoiceAnswer("success", "partial"),
      textAnswer("blocker", `${marker}-blocker`),
    ],
    dashboardValues: (marker) => [
      `${marker}-task`,
      "Delvis",
      `${marker}-blocker`,
    ],
  },
  {
    id: "top-tasks",
    authoringFormat: "document-v1",
    surveyType: "topTasks",
    dashboardType: "Top Tasks",
    facets: ["singleChoice", "text", "pages", "visibleIf"],
    actions: [
      { kind: "radio", name: "Noe annet" },
      { kind: "next" },
      {
        kind: "textbox",
        name: "Beskriv hva du prøvde å gjøre",
        suffix: "-other-task",
      },
      { kind: "next" },
      { kind: "radio", name: "Delvis" },
      { kind: "next" },
      { kind: "textbox", name: "Hva hindret deg?", suffix: "-blocker" },
    ],
    fields: [
      { fieldId: "task", fieldType: "SINGLE_CHOICE" },
      { fieldId: "otherTask", fieldType: "TEXT" },
      { fieldId: "success", fieldType: "SINGLE_CHOICE" },
      { fieldId: "blocker", fieldType: "TEXT" },
    ],
    expectedAnswers: (marker) => [
      singleChoiceAnswer("task", "other"),
      textAnswer("otherTask", `${marker}-other-task`),
      singleChoiceAnswer("success", "partial"),
      textAnswer("blocker", `${marker}-blocker`),
    ],
    dashboardValues: (marker) => [
      "Noe annet",
      `${marker}-other-task`,
      "Delvis",
      `${marker}-blocker`,
    ],
  },
  taskPriorityScenario("task-priority-checkbox", "checkbox", [
    { kind: "checkbox", name: "Søke om en ytelse" },
    { kind: "checkbox", name: "Sjekke status" },
  ]),
  taskPriorityScenario("task-priority-combobox", "combobox", [
    {
      kind: "combobox",
      name: "Hvilke oppgaver er viktigst for deg?",
      options: ["Søke om en ytelse", "Sjekke status"],
    },
  ]),
  {
    id: "custom-field-matrix",
    authoringFormat: "document-v1",
    surveyType: "custom",
    dashboardType: "Custom",
    facets: ["text", "singleChoice", "multiChoice", "checkbox"],
    actions: [
      {
        kind: "textbox",
        name: "Hva vil du teste i dag?",
        suffix: "-custom",
      },
      { kind: "radio", name: "Web" },
      { kind: "checkbox", name: "Tydelig" },
      { kind: "checkbox", name: "Trygg" },
    ],
    fields: [
      { fieldId: "customText", fieldType: "TEXT" },
      { fieldId: "customSingle", fieldType: "SINGLE_CHOICE" },
      { fieldId: "customMulti", fieldType: "MULTI_CHOICE" },
    ],
    expectedAnswers: (marker) => [
      textAnswer("customText", `${marker}-custom`),
      singleChoiceAnswer("customSingle", "web"),
      multiChoiceAnswer("customMulti", ["clear", "safe"]),
    ],
    dashboardValues: (marker) => [
      `${marker}-custom`,
      "Web",
      "Tydelig",
      "Trygg",
    ],
  },
  {
    id: "pages-multi-question",
    authoringFormat: "document-v1",
    surveyType: "custom",
    dashboardType: "Custom",
    facets: ["pages", "multi-question", "visibleIf", "stars"],
    actions: [
      { kind: "radio", name: "4 av 5 stjerner. Bra" },
      {
        kind: "textbox",
        name: "Hva la du særlig merke til?",
        suffix: "-noticed",
      },
      { kind: "next" },
      { kind: "radio", name: "Ja" },
      {
        kind: "textbox",
        name: "Hva bør vi forbedre?",
        suffix: "-improvement",
      },
    ],
    fields: [
      ratingField("pageRating", "stars", 5),
      { fieldId: "pageReason", fieldType: "TEXT" },
      { fieldId: "pageFollowUp", fieldType: "SINGLE_CHOICE" },
      { fieldId: "pageImprovement", fieldType: "TEXT" },
    ],
    expectedAnswers: (marker) => [
      ratingAnswer("pageRating", "stars", 5, 4),
      textAnswer("pageReason", `${marker}-noticed`),
      singleChoiceAnswer("pageFollowUp", "yes"),
      textAnswer("pageImprovement", `${marker}-improvement`),
    ],
    dashboardValues: (marker) => [
      `${marker}-noticed`,
      "Ja",
      `${marker}-improvement`,
    ],
  },
];

test("the full chain produces one terminal release-verification report", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const startedAt = new Date().toISOString();
  const failures: string[] = [];
  let matrixEvidence: MatrixScenarioEvidence[] = [];
  let legacyCompatibility = failedLegacyCompatibilityEvidence(
    "Kompatibilitetssporet ble ikke kjørt",
  );
  let localProxyStatus: "passed" | "failed" = "passed";
  let controlledReport: FullChainReport | null = null;

  try {
    const matrixResult = await verifyLocalSurveyMatrix(page);
    matrixEvidence = matrixResult.matrix;
    legacyCompatibility = matrixResult.legacyCompatibility;
    const matrixFailures = matrixEvidence.filter(
      ({ status }) => status === "failed",
    );
    if (matrixFailures.length > 0) {
      localProxyStatus = "failed";
      failures.push(
        ...matrixFailures
          .filter(({ authoringFormat }) => authoringFormat !== "legacy-flat")
          .map(
            ({ scenarioId, detail }) =>
              `survey-contract-matrix/${scenarioId}: ${detail}`,
          ),
      );
    }
  } catch (error) {
    localProxyStatus = "failed";
    failures.push(`survey-contract-matrix: ${errorMessage(error)}`);
  }

  if (legacyCompatibility.status === "failed") {
    localProxyStatus = "failed";
    failures.push(`legacy-compatibility: ${legacyCompatibility.detail}`);
  }

  try {
    controlledReport = await verifyControlledDashboardRoundTrip(page);
  } catch (error) {
    failures.push(`controlled-dashboard-round-trip: ${errorMessage(error)}`);
  }

  const finishedAt = new Date().toISOString();
  const report = controlledReport ?? createFailedReport(startedAt, finishedAt);
  report.coverage.localSubmissionProxy = localProxyStatus;
  report.coverage.surveyContractMatrix = localProxyStatus;
  report.coverage.legacyCompatibility = legacyCompatibility.status;
  report.checks.push({
    id: "local-submission-proxy",
    status: localProxyStatus,
    completedAt: finishedAt,
    detail:
      localProxyStatus === "passed"
        ? "Widget → lokal proxy → API → Postgres → dashboard er verifisert for hele matrisen"
        : "Den lokale proxy-rundturen feilet",
  });
  report.checks.push({
    id: "survey-contract-matrix",
    status: localProxyStatus,
    completedAt: finishedAt,
    detail:
      localProxyStatus === "passed"
        ? `${matrixEvidence.length}/${MATRIX_SCENARIOS.length} survey- og feltvarianter er verifisert`
        : `${matrixEvidence.filter(({ status }) => status === "passed").length}/${MATRIX_SCENARIOS.length} survey- og feltvarianter er verifisert`,
  });
  report.checks.push({
    id: "legacy-compatibility",
    status: legacyCompatibility.status,
    completedAt: finishedAt,
    detail: legacyCompatibility.detail,
  });
  report.automation = {
    runner: "playwright",
    failures,
    matrix: matrixEvidence,
    legacyCompatibility,
  };
  report.generatedAt = finishedAt;
  report.finishedAt = finishedAt;
  if (failures.length > 0 || report.outcome !== "passed") {
    report.outcome = "failed";
  }

  await writeEvidence(report, testInfo);
  expect(failures, failures.join("\n")).toEqual([]);
  expect(report.outcome).toBe("passed");
});

async function verifyLocalSurveyMatrix(
  page: Page,
): Promise<LocalSurveyMatrixResult> {
  await page.goto(DEMO_URL);
  await expect(
    page.getByRole("heading", { name: "Full-chain testbenk" }),
  ).toBeVisible();
  const scenarioSelect = page.getByRole("combobox", {
    name: "Survey- og feltvariant",
  });
  const renderedScenarios = await scenarioSelect
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => ({
        id: (option as HTMLOptionElement).value,
        authoringFormat: option.getAttribute("data-authoring-format"),
      })),
    );
  expect(renderedScenarios).toEqual(
    MATRIX_SCENARIOS.map(({ id, authoringFormat }) => ({
      id,
      authoringFormat,
    })),
  );

  const evidence: MatrixScenarioEvidence[] = [];
  let legacyCompatibility: LegacyCompatibilityEvidence | null = null;
  for (const scenario of MATRIX_SCENARIOS) {
    try {
      if (scenario.authoringFormat === "legacy-flat") {
        const result = await verifyLegacyCompatibilityScenario(page, scenario);
        evidence.push(result.matrix);
        legacyCompatibility = result.compatibility;
      } else {
        evidence.push(await verifyMatrixScenario(page, scenario));
      }
    } catch (error) {
      evidence.push({
        scenarioId: scenario.id,
        surveyId: `local-demo-${scenario.id}`,
        surveyType: scenario.surveyType,
        authoringFormat: scenario.authoringFormat,
        facets: scenario.facets,
        status: "failed",
        receiptId:
          error instanceof MatrixScenarioFailure ? error.receiptId : null,
        detail: errorMessage(error),
      });
      if (scenario.authoringFormat === "legacy-flat") {
        legacyCompatibility =
          error instanceof LegacyCompatibilityFailure
            ? failedLegacyCompatibilityEvidence(error.message, error)
            : failedLegacyCompatibilityEvidence(errorMessage(error));
      }
    }
  }
  expect(
    legacyCompatibility,
    "legacy-flat-scenario mangler i matrisen",
  ).not.toBeNull();
  return {
    matrix: evidence,
    legacyCompatibility:
      legacyCompatibility ??
      failedLegacyCompatibilityEvidence(
        "legacy-flat-scenario mangler i matrisen",
      ),
  };
}

async function verifyMatrixScenario(
  page: Page,
  scenario: MatrixScenario,
): Promise<MatrixScenarioEvidence> {
  const surveyId = `local-demo-${scenario.id}`;
  const marker = `matrix-${scenario.id}-${Date.now()}`;
  let receiptId: string | null = null;
  try {
    const widget = await openAndFillScenario(page, scenario, marker);
    const submission = await submitCurrentWidget(page, widget);
    receiptId = submission.receiptId;
    await assertCurrentWidgetSubmission(
      page,
      submission.response,
      scenario,
      surveyId,
      marker,
    );
    const feedbackTable = await openSurveyFeedback(page, surveyId);
    await assertReceiptReadback(page, feedbackTable, {
      receiptId,
      surveyId,
      values: scenario.dashboardValues(marker),
    });
    await assertDashboardType(page, scenario, surveyId);

    return {
      scenarioId: scenario.id,
      surveyId,
      surveyType: scenario.surveyType,
      authoringFormat: scenario.authoringFormat,
      facets: scenario.facets,
      status: "passed",
      receiptId,
      detail: "Payload, lagring, feedbackrad og dashboardtype er verifisert",
    };
  } catch (error) {
    throw new MatrixScenarioFailure(errorMessage(error), receiptId);
  }
}

async function verifyLegacyCompatibilityScenario(
  page: Page,
  scenario: MatrixScenario,
): Promise<{
  matrix: MatrixScenarioEvidence;
  compatibility: LegacyCompatibilityEvidence;
}> {
  const surveyId = `local-demo-${scenario.id}`;
  const markerSeed = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const legacyMarker = `legacy-v1-${markerSeed}`;
  const widgetMarker = `widget-v2-${markerSeed}`;
  let legacyReceiptId: string | null = null;
  let widgetReceiptId: string | null = null;
  let legacyReadback: LegacySubmissionEvidence["readback"] = "not-tested";
  let widgetReadback: LegacySubmissionEvidence["readback"] = "not-tested";

  try {
    const widget = await openAndFillScenario(
      page,
      scenario,
      widgetMarker,
      false,
    );
    legacyReceiptId = await submitLegacyV1(page, {
      surveyId,
      scenarioId: scenario.id,
      marker: legacyMarker,
    });

    for (const action of scenario.actions) {
      await performMatrixAction(page, widget, action, widgetMarker);
    }
    const widgetSubmission = await submitCurrentWidget(page, widget);
    widgetReceiptId = widgetSubmission.receiptId;
    await assertCurrentWidgetSubmission(
      page,
      widgetSubmission.response,
      scenario,
      surveyId,
      widgetMarker,
    );
    expect(widgetReceiptId).not.toBe(legacyReceiptId);

    const feedbackTable = await openSurveyFeedback(page, surveyId);
    try {
      await assertReceiptReadback(page, feedbackTable, {
        receiptId: legacyReceiptId,
        surveyId,
        values: [legacyMarker, "3/5"],
      });
      legacyReadback = "passed";
    } catch (error) {
      legacyReadback = "failed";
      throw error;
    }
    try {
      await assertReceiptReadback(page, feedbackTable, {
        receiptId: widgetReceiptId,
        surveyId,
        values: scenario.dashboardValues(widgetMarker),
      });
      widgetReadback = "passed";
    } catch (error) {
      widgetReadback = "failed";
      throw error;
    }
    await assertDashboardType(page, scenario, surveyId);

    const detail =
      "Schema v1 og flatkonfigurert widget-schema v2 ble lagret med ulike kvitteringer og lest tilbake i dashboardet";
    return {
      matrix: {
        scenarioId: scenario.id,
        surveyId,
        surveyType: scenario.surveyType,
        authoringFormat: scenario.authoringFormat,
        facets: scenario.facets,
        status: "passed",
        receiptId: widgetReceiptId,
        detail,
      },
      compatibility: {
        scenarioId: "legacy-flat-rating",
        surveyId,
        status: "passed",
        legacySubmission: {
          schemaVersion: 1,
          receiptId: legacyReceiptId,
          marker: legacyMarker,
          readback: legacyReadback,
        },
        widgetSubmission: {
          schemaVersion: 2,
          receiptId: widgetReceiptId,
          marker: `${widgetMarker}-emoji`,
          readback: widgetReadback,
        },
        detail,
      },
    };
  } catch (error) {
    throw new LegacyCompatibilityFailure(
      errorMessage(error),
      legacyReceiptId,
      widgetReceiptId,
      legacyMarker,
      `${widgetMarker}-emoji`,
      legacyReadback,
      widgetReadback,
    );
  }
}

async function openAndFillScenario(
  page: Page,
  scenario: MatrixScenario,
  marker: string,
  performActions = true,
): Promise<Locator> {
  await page.goto(DEMO_URL);
  await page
    .getByRole("combobox", { name: "Survey- og feltvariant" })
    .selectOption(scenario.id);
  await expect(
    page.getByText(surveyIdFor(scenario), { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(scenario.authoringFormat, { exact: true }),
  ).toBeVisible();

  const widget = page.getByRole("complementary", {
    name: "Tilbakemeldingspanel",
  });
  if (performActions) {
    for (const action of scenario.actions) {
      await performMatrixAction(page, widget, action, marker);
    }
  }
  return widget;
}

async function submitCurrentWidget(
  page: Page,
  widget: Locator,
): Promise<CurrentWidgetSubmission> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/azure/v1/feedback"),
  );
  await widget.getByRole("button", { name: "Send", exact: true }).click();
  const response = await responsePromise;
  const responseBody = await response.text();
  expect(response.status(), responseBody).toBe(201);
  const receipt = JSON.parse(responseBody) as { id?: string };
  expect(receipt.id).toEqual(expect.any(String));
  return { receiptId: receipt.id ?? "", response };
}

async function assertCurrentWidgetSubmission(
  page: Page,
  response: Response,
  scenario: MatrixScenario,
  surveyId: string,
  marker: string,
): Promise<void> {
  const payload = response
    .request()
    .postDataJSON() as LumiApiFeedbackSubmissionV2;
  assertTransportPayload(payload, scenario, surveyId, marker);
  await expect(
    page.getByRole("heading", { name: "Signal lagret" }),
  ).toBeVisible();
}

async function submitLegacyV1(
  page: Page,
  input: { surveyId: string; scenarioId: string; marker: string },
): Promise<string> {
  const payload: LumiApiFeedbackSubmissionV1 = {
    schemaVersion: 1,
    surveyId: input.surveyId,
    surveyType: "rating",
    submittedAt: new Date().toISOString(),
    context: {
      tags: {
        environment: "local-full-chain",
        scenario: input.scenarioId,
        compatibilityPhase: "legacy-v1",
      },
    },
    answers: [
      {
        fieldId: "rating",
        fieldType: "RATING",
        question: { label: "Hvordan var opplevelsen?" },
        value: {
          type: "rating",
          rating: 3,
          ratingVariant: "emoji",
          ratingScale: 5,
        },
      },
      {
        fieldId: "feedback",
        fieldType: "TEXT",
        question: { label: "Hva bør vi forbedre?" },
        value: { type: "text", text: input.marker },
      },
    ],
  };
  expect(payload).not.toHaveProperty("definition");
  expect(payload).not.toHaveProperty("deduplicationKey");
  const response = await page.evaluate(async (body) => {
    const result = await fetch("/api/azure/v1/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: result.status, body: await result.text() };
  }, payload);
  expect(response.status, response.body).toBe(201);
  const receipt = JSON.parse(response.body) as { id?: string };
  expect(receipt.id).toEqual(expect.any(String));
  return receipt.id ?? "";
}

async function openSurveyFeedback(
  page: Page,
  surveyId: string,
): Promise<Locator> {
  await page.goto(
    `${DASHBOARD_URL}/feedback?team=local-dev&app=local-app&surveyId=${encodeURIComponent(surveyId)}&dateMode=auto`,
  );
  await expect(page.getByText(/Viser \d+ svar for/)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "App" }).first()).toHaveValue(
    "local-app",
  );
  return page.getByRole("table");
}

async function assertReceiptReadback(
  page: Page,
  feedbackTable: Locator,
  input: {
    receiptId: string;
    surveyId: string;
    values: string[];
  },
): Promise<void> {
  const dataRows = feedbackTable.locator("tbody > tr").filter({
    has: page.getByRole("button", { name: /^(Utvid|Minimer) rad$/ }),
  });
  await expect(dataRows.first()).toBeVisible();

  const receipt = feedbackTable.getByText(`ID: ${input.receiptId}`, {
    exact: true,
  });
  let dataRow: Locator | null = null;
  const rowCount = await dataRows.count();
  for (let index = 0; index < rowCount; index += 1) {
    const candidate = dataRows.nth(index);
    const expandButton = candidate.getByRole("button", { name: "Utvid rad" });
    if (await expandButton.isVisible()) {
      await expandButton.click({ timeout: 5_000 });
    }
    const minimizeButton = candidate.getByRole("button", {
      name: "Minimer rad",
    });
    await expect(minimizeButton).toBeVisible();
    if (await receipt.isVisible()) {
      dataRow = candidate;
      break;
    }
    await minimizeButton.click({ timeout: 5_000 });
  }

  if (dataRow === null) {
    throw new Error(`Fant ikke feedbackrad med ID ${input.receiptId}`);
  }
  await expect(dataRow).toContainText(input.surveyId);
  await expect(dataRow).toContainText("local-app");
  await expect(receipt).toBeVisible();
  const expandedRow = receipt.locator("xpath=ancestor::tr");
  await expect(expandedRow).toContainText(`Survey: ${input.surveyId}`);
  for (const value of input.values) {
    await expect(expandedRow).toContainText(value);
  }
}

async function assertDashboardType(
  page: Page,
  scenario: MatrixScenario,
  surveyId: string,
): Promise<void> {
  await page.goto(
    `${DASHBOARD_URL}/?team=local-dev&app=local-app&surveyId=${encodeURIComponent(surveyId)}&dateMode=auto`,
  );
  await expect(
    page
      .locator("main")
      .getByText(scenario.dashboardType, { exact: true })
      .first(),
  ).toBeVisible();
}

function surveyIdFor(scenario: MatrixScenario): string {
  return `local-demo-${scenario.id}`;
}

function failedLegacyCompatibilityEvidence(
  detail: string,
  failure?: LegacyCompatibilityFailure,
): LegacyCompatibilityEvidence {
  return {
    scenarioId: "legacy-flat-rating",
    surveyId: "local-demo-legacy-flat-rating",
    status: "failed",
    legacySubmission: {
      schemaVersion: 1,
      receiptId: failure?.legacyReceiptId ?? null,
      marker: failure?.legacyMarker ?? null,
      readback: failure?.legacyReadback ?? "not-tested",
    },
    widgetSubmission: {
      schemaVersion: 2,
      receiptId: failure?.receiptId ?? null,
      marker: failure?.widgetMarker ?? null,
      readback: failure?.widgetReadback ?? "not-tested",
    },
    detail,
  };
}

async function performMatrixAction(
  page: Page,
  widget: Locator,
  action: MatrixAction,
  marker: string,
): Promise<void> {
  switch (action.kind) {
    case "radio":
      await widget
        .getByRole("radio", { name: action.name })
        .click({ timeout: 5_000 });
      return;
    case "textbox":
      await widget
        .getByRole("textbox", { name: action.name })
        .fill(`${marker}${action.suffix}`, { timeout: 5_000 });
      return;
    case "checkbox":
      await widget
        .getByRole("checkbox", { name: action.name })
        .check({ timeout: 5_000 });
      return;
    case "combobox": {
      const combobox = widget.getByRole("combobox", { name: action.name });
      for (const option of action.options) {
        await combobox.fill(option, { timeout: 5_000 });
        await page
          .getByRole("option", { name: option, exact: true })
          .click({ timeout: 5_000 });
      }
      return;
    }
    case "next":
      await widget
        .getByRole("button", { name: "Neste", exact: true })
        .click({ timeout: 5_000 });
      return;
  }
}

function assertTransportPayload(
  payload: LumiApiFeedbackSubmissionV2,
  scenario: MatrixScenario,
  surveyId: string,
  marker: string,
): void {
  expect(payload).toMatchObject({
    schemaVersion: 2,
    surveyId,
    surveyType: scenario.surveyType,
    definition: { surveyType: scenario.surveyType },
    context: {
      tags: {
        environment: "local-full-chain",
        scenario: scenario.id,
      },
    },
  });
  expect(payload.definition.fields).toHaveLength(scenario.fields.length);
  for (const expectedField of scenario.fields) {
    expect(
      payload.definition.fields.find(
        ({ fieldId }) => fieldId === expectedField.fieldId,
      ),
    ).toEqual(expect.objectContaining({ ...expectedField }));
  }

  const expectedAnswers = scenario.expectedAnswers(marker);
  expect(payload.answers).toHaveLength(expectedAnswers.length);
  for (const expectedAnswer of expectedAnswers) {
    expect(
      payload.answers.find(({ fieldId }) => fieldId === expectedAnswer.fieldId),
    ).toEqual(expect.objectContaining({ ...expectedAnswer }));
  }
}

function ratingScenario({
  id,
  authoringFormat = "document-v1",
  facet,
  ratingFieldId,
  ratingAction,
  rating,
  textFieldId,
  textPrompt,
}: {
  id: string;
  authoringFormat?: MatrixScenario["authoringFormat"];
  facet: "emoji" | "thumbs" | "stars" | "nps";
  ratingFieldId: string;
  ratingAction: Extract<MatrixAction, { kind: "radio" }>;
  rating: number;
  textFieldId: string;
  textPrompt: string;
}): MatrixScenario {
  const scale = facet === "thumbs" ? 2 : facet === "nps" ? 11 : 5;
  const dashboardRating =
    facet === "thumbs"
      ? "👍 Ja"
      : facet === "nps"
        ? `${rating}/10`
        : `${rating}/${scale}`;
  return {
    id,
    authoringFormat,
    surveyType: "rating",
    dashboardType: "Vurdering",
    facets: ["rating", facet, "text", "visibleIf"],
    actions: [
      ratingAction,
      {
        kind: "textbox",
        name: textPrompt,
        suffix: `-${facet}`,
      },
    ],
    fields: [
      ratingField(ratingFieldId, facet, scale),
      { fieldId: textFieldId, fieldType: "TEXT" },
    ],
    expectedAnswers: (marker) => [
      ratingAnswer(ratingFieldId, facet, scale, rating),
      textAnswer(textFieldId, `${marker}-${facet}`),
    ],
    dashboardValues: (marker) => [`${marker}-${facet}`, dashboardRating],
  };
}

function taskPriorityScenario(
  id: string,
  facet: "checkbox" | "combobox",
  actions: MatrixAction[],
): MatrixScenario {
  return {
    id,
    authoringFormat: "document-v1",
    surveyType: "taskPriority",
    dashboardType: "Task Priority",
    facets: ["multiChoice", facet],
    actions,
    fields: [
      {
        fieldId: "priority",
        fieldType: "MULTI_CHOICE",
        maxSelections: 3,
      },
    ],
    expectedAnswers: () => [
      multiChoiceAnswer("priority", [TASK_OPTIONS[0], TASK_OPTIONS[1]]),
    ],
    dashboardValues: () => ["Søke om en ytelse", "Sjekke status"],
  };
}

function ratingField(
  fieldId: string,
  ratingVariant: "emoji" | "thumbs" | "stars" | "nps",
  ratingScale: number,
): TransportFieldDefinition {
  return { fieldId, fieldType: "RATING", ratingVariant, ratingScale };
}

function ratingAnswer(
  fieldId: string,
  ratingVariant: "emoji" | "thumbs" | "stars" | "nps",
  ratingScale: number,
  rating: number,
): TransportAnswer {
  return {
    fieldId,
    fieldType: "RATING",
    value: { type: "rating", rating, ratingVariant, ratingScale },
  };
}

function textAnswer(fieldId: string, text: string): TransportAnswer {
  return {
    fieldId,
    fieldType: "TEXT",
    value: { type: "text", text },
  };
}

function singleChoiceAnswer(
  fieldId: string,
  selectedOptionId: string,
): TransportAnswer {
  return {
    fieldId,
    fieldType: "SINGLE_CHOICE",
    value: { type: "singleChoice", selectedOptionId },
  };
}

function multiChoiceAnswer(
  fieldId: string,
  selectedOptionIds: string[],
): TransportAnswer {
  return {
    fieldId,
    fieldType: "MULTI_CHOICE",
    value: { type: "multiChoice", selectedOptionIds },
  };
}

async function verifyControlledDashboardRoundTrip(
  page: Page,
): Promise<FullChainReport> {
  await page.goto(`${DASHBOARD_URL}/release-verification`);
  await expect(
    page.getByRole("heading", { name: "Bevis kjeden før utrulling" }),
  ).toBeVisible();
  await expect(
    page.getByText("Teamtilgang er bekreftet før skrivetesten starter."),
  ).toBeVisible();

  await submitReleaseProbe(page);
  await expect(page.getByText(/Holdetiden er ferdig/)).toBeVisible();
  await submitReleaseProbe(page);
  await expect(
    page.getByRole("heading", {
      name: "Kontrollert dev-kjede bestått",
    }),
  ).toBeVisible();

  const reportText = await page.locator("pre").textContent();
  expect(reportText).not.toBeNull();
  const report = JSON.parse(reportText ?? "{}") as FullChainReport;
  expect(report.schemaVersion).toBe(1);
  expect(report.outcome).toBe("passed");
  expect(report.coverage).toMatchObject({
    controlledRoundTrip: "passed",
    navWideRelease: "pending",
  });
  return report;
}

async function submitReleaseProbe(page: Page): Promise<void> {
  await page.getByRole("radio", { name: "4. Bra" }).click();
  await page.getByRole("radio", { name: /Kontrollkode RV-/ }).click();
  await page.getByRole("button", { name: "Send" }).click();
}

function createFailedReport(
  startedAt: string,
  finishedAt: string,
): FullChainReport {
  return {
    schemaVersion: 1,
    profileVersion: 1,
    profile: "local-full-chain",
    runId: `full-chain-${Date.now()}`,
    environment: "local",
    generatedAt: finishedAt,
    startedAt,
    finishedAt,
    outcome: "failed",
    subject: {
      surveyId: "not-created",
      team: "local-dev",
      app: "local-app",
    },
    observeAfter: null,
    checks: [
      {
        id: "controlled-dashboard-round-trip",
        status: "failed",
        completedAt: finishedAt,
        detail: "Dashboard-rundturen produserte ingen lesbar rapport",
      },
    ],
    probes: { initial: null, closing: null },
    coverage: {
      controlledRoundTrip: "failed",
      localSubmissionProxy: "not-tested",
      legacyCompatibility: "failed",
      globalAzureHealth: "not-assessed",
      trygdeetatenProxy: "not-tested",
      navWideRelease: "pending",
    },
  };
}

async function writeEvidence(
  report: FullChainReport,
  testInfo: TestInfo,
): Promise<void> {
  const evidencePath = resolve(
    testInfo.project.outputDir,
    "..",
    "release-verification-report.json",
  );
  await writeFile(evidencePath, JSON.stringify(report, null, 2));
  await testInfo.attach("release-verification-report.json", {
    path: evidencePath,
    contentType: "application/json",
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
