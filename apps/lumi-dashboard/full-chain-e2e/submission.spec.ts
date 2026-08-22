import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";

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
    globalAzureHealth: "not-assessed";
    trygdeetatenProxy: "not-tested";
    navWideRelease: "pending";
  };
  automation?: {
    runner: "playwright";
    failures: string[];
  };
}

test("the full chain produces one terminal release-verification report", async ({
  page,
}, testInfo) => {
  const startedAt = new Date().toISOString();
  const failures: string[] = [];
  let localProxyStatus: "passed" | "failed" = "passed";
  let controlledReport: FullChainReport | null = null;

  try {
    await verifyLocalProxyRoundTrip(page);
  } catch (error) {
    localProxyStatus = "failed";
    failures.push(`local-submission-proxy: ${errorMessage(error)}`);
  }

  try {
    controlledReport = await verifyControlledDashboardRoundTrip(page);
  } catch (error) {
    failures.push(`controlled-dashboard-round-trip: ${errorMessage(error)}`);
  }

  const finishedAt = new Date().toISOString();
  const report = controlledReport ?? createFailedReport(startedAt, finishedAt);
  report.coverage.localSubmissionProxy = localProxyStatus;
  report.checks.push({
    id: "local-submission-proxy",
    status: localProxyStatus,
    completedAt: finishedAt,
    detail:
      localProxyStatus === "passed"
        ? "Widget → lokal proxy → API → Postgres → dashboard er verifisert"
        : "Den lokale proxy-rundturen feilet",
  });
  report.automation = { runner: "playwright", failures };
  report.generatedAt = finishedAt;
  report.finishedAt = finishedAt;
  if (failures.length > 0 || report.outcome !== "passed") {
    report.outcome = "failed";
  }

  await writeEvidence(report, testInfo);
  expect(failures, failures.join("\n")).toEqual([]);
  expect(report.outcome).toBe("passed");
});

async function verifyLocalProxyRoundTrip(page: Page): Promise<void> {
  const feedback = `full-chain-${Date.now()}`;
  await page.goto(DEMO_URL);
  await expect(
    page.getByRole("heading", { name: "Full-chain testbenk" }),
  ).toBeVisible();

  await page.getByRole("radio", { name: "4. Bra" }).click();
  await page
    .getByRole("textbox", { name: "Har du andre tilbakemeldinger?" })
    .fill(feedback);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(
    page.getByRole("heading", { name: "Signal lagret" }),
  ).toBeVisible();

  await page.goto(
    `${DASHBOARD_URL}/feedback?team=local-dev&app=local-app&surveyId=local-demo-rating-emoji&dateMode=auto`,
  );
  await expect(
    page.getByRole("table").getByText(feedback, { exact: true }).first(),
  ).toBeVisible();
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
