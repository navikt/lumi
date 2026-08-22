import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expect,
  type Locator,
  type Page,
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
    globalAzureHealth: "not-assessed";
    trygdeetatenProxy: "not-tested";
    navWideRelease: "pending";
  };
  automation?: {
    runner: "playwright";
    failures: string[];
    matrix: MatrixScenarioEvidence[];
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

interface TransportPayload {
  schemaVersion: number;
  surveyId: string;
  surveyType: string;
  definition: {
    surveyType: string;
    fields: TransportFieldDefinition[];
  };
  context?: { tags?: Record<string, string> };
  answers: TransportAnswer[];
}

type MatrixAction =
  | { kind: "radio"; name: string | RegExp }
  | { kind: "textbox"; name: string; suffix: string }
  | { kind: "checkbox"; name: string }
  | { kind: "combobox"; name: string; options: string[] }
  | { kind: "next" };

interface MatrixScenario {
  id: string;
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
  facets: string[];
  status: "passed" | "failed";
  receiptId: string | null;
  detail: string;
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
  let localProxyStatus: "passed" | "failed" = "passed";
  let controlledReport: FullChainReport | null = null;

  try {
    matrixEvidence = await verifyLocalSurveyMatrix(page);
    const matrixFailures = matrixEvidence.filter(
      ({ status }) => status === "failed",
    );
    if (matrixFailures.length > 0) {
      localProxyStatus = "failed";
      failures.push(
        ...matrixFailures.map(
          ({ scenarioId, detail }) =>
            `survey-contract-matrix/${scenarioId}: ${detail}`,
        ),
      );
    }
  } catch (error) {
    localProxyStatus = "failed";
    failures.push(`survey-contract-matrix: ${errorMessage(error)}`);
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
  report.automation = {
    runner: "playwright",
    failures,
    matrix: matrixEvidence,
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
): Promise<MatrixScenarioEvidence[]> {
  await page.goto(DEMO_URL);
  await expect(
    page.getByRole("heading", { name: "Full-chain testbenk" }),
  ).toBeVisible();
  const scenarioSelect = page.getByRole("combobox", {
    name: "Survey- og feltvariant",
  });
  const renderedScenarioIds = await scenarioSelect
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
  expect(renderedScenarioIds).toEqual(MATRIX_SCENARIOS.map(({ id }) => id));

  const evidence: MatrixScenarioEvidence[] = [];
  for (const scenario of MATRIX_SCENARIOS) {
    try {
      evidence.push(await verifyMatrixScenario(page, scenario));
    } catch (error) {
      evidence.push({
        scenarioId: scenario.id,
        surveyId: `local-demo-${scenario.id}`,
        surveyType: scenario.surveyType,
        facets: scenario.facets,
        status: "failed",
        receiptId:
          error instanceof MatrixScenarioFailure ? error.receiptId : null,
        detail: errorMessage(error),
      });
    }
  }
  return evidence;
}

async function verifyMatrixScenario(
  page: Page,
  scenario: MatrixScenario,
): Promise<MatrixScenarioEvidence> {
  const surveyId = `local-demo-${scenario.id}`;
  const marker = `matrix-${scenario.id}-${Date.now()}`;
  let receiptId: string | null = null;
  try {
    await page.goto(DEMO_URL);
    await page
      .getByRole("combobox", { name: "Survey- og feltvariant" })
      .selectOption(scenario.id);
    await expect(page.getByText(surveyId, { exact: true })).toBeVisible();

    const widget = page.getByRole("complementary", {
      name: "Tilbakemeldingspanel",
    });
    for (const action of scenario.actions) {
      await performMatrixAction(page, widget, action, marker);
    }

    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/azure/v1/feedback"),
    );
    await widget.getByRole("button", { name: "Send", exact: true }).click();
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    const receipt = (await response.json()) as { id?: string };
    expect(receipt.id).toEqual(expect.any(String));
    receiptId = receipt.id ?? null;
    const payload = response.request().postDataJSON() as TransportPayload;
    assertTransportPayload(payload, scenario, surveyId, marker);

    await expect(
      page.getByRole("heading", { name: "Signal lagret" }),
    ).toBeVisible();

    await page.goto(
      `${DASHBOARD_URL}/feedback?team=local-dev&app=local-app&surveyId=${encodeURIComponent(surveyId)}&dateMode=auto`,
    );
    await expect(page.getByText(/Viser \d+ svar for/)).toBeVisible();
    const feedbackTable = page.getByRole("table");
    const newestRow = feedbackTable.getByRole("row").nth(1);
    await expect(newestRow).toBeVisible();
    await newestRow
      .getByRole("button", { name: "Utvid rad" })
      .click({ timeout: 5_000 });
    const expandedRow = feedbackTable.getByRole("row").nth(2);
    await expect(expandedRow).toBeVisible();
    for (const value of scenario.dashboardValues(marker)) {
      await expect(expandedRow).toContainText(value);
    }

    await page.goto(
      `${DASHBOARD_URL}/?team=local-dev&app=local-app&surveyId=${encodeURIComponent(surveyId)}&dateMode=auto`,
    );
    await expect(
      page
        .locator("main")
        .getByText(scenario.dashboardType, { exact: true })
        .first(),
    ).toBeVisible();

    return {
      scenarioId: scenario.id,
      surveyId,
      surveyType: scenario.surveyType,
      facets: scenario.facets,
      status: "passed",
      receiptId,
      detail: "Payload, lagring, feedbackrad og dashboardtype er verifisert",
    };
  } catch (error) {
    throw new MatrixScenarioFailure(errorMessage(error), receiptId);
  }
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
  payload: TransportPayload,
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
    ).toMatchObject(expectedField);
  }

  const expectedAnswers = scenario.expectedAnswers(marker);
  expect(payload.answers).toHaveLength(expectedAnswers.length);
  for (const expectedAnswer of expectedAnswers) {
    expect(
      payload.answers.find(({ fieldId }) => fieldId === expectedAnswer.fieldId),
    ).toMatchObject(expectedAnswer);
  }
}

function ratingScenario({
  id,
  facet,
  ratingFieldId,
  ratingAction,
  rating,
  textFieldId,
  textPrompt,
}: {
  id: string;
  facet: "emoji" | "thumbs" | "stars" | "nps";
  ratingFieldId: string;
  ratingAction: Extract<MatrixAction, { kind: "radio" }>;
  rating: number;
  textFieldId: string;
  textPrompt: string;
}): MatrixScenario {
  const scale = facet === "thumbs" ? 2 : facet === "nps" ? 11 : 5;
  return {
    id,
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
    dashboardValues: (marker) => [`${marker}-${facet}`],
  };
}

function taskPriorityScenario(
  id: string,
  facet: "checkbox" | "combobox",
  actions: MatrixAction[],
): MatrixScenario {
  return {
    id,
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
