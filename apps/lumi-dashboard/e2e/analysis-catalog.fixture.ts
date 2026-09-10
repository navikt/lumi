import type { Page } from "@playwright/test";
import type { AnalysisCatalog } from "../app/types/analysisProducts";

export const longSurveyId = `oppfolging-av-ansatte-${"lang-survey-identifikator-".repeat(5)}24`;
export const longFieldId = `vurdering-${"lang-felt-identifikator-".repeat(5)}`;

export async function useLargeAnalysisCatalog(page: Page) {
  let catalogReplaced = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (
      request.method() !== "GET" ||
      !["fetch", "xhr"].includes(request.resourceType())
    ) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.text();
    if (!body.includes('"demo-catalog"')) {
      await route.fulfill({ response });
      return;
    }
    const field = (
      fieldId: string,
    ): AnalysisCatalog["sources"][number]["fields"][number] => ({
      fieldId,
      fieldType: "RATING",
      label: null,
      labelSource: "UNKNOWN",
      ratingScale: 5,
      optionIds: null,
      flowDependencies: [],
    });
    const catalog: AnalysisCatalog = {
      demo: true,
      schemaVersion: 1,
      team: "team-esyfo",
      catalogRevision: "large-test-catalog",
      sources: [
        {
          app: "demo-app",
          surveyId: "opplevelse-v2",
          archived: false,
          definitionStatus: "REGISTERED",
          flowStatus: "PINNED",
          warnings: [],
          fields: [field("vurdering")],
        },
        ...Array.from({ length: 24 }, (_, index) => ({
          app: `oppfolging-app-${index % 4}`,
          surveyId:
            index === 23 ? longSurveyId : `oppfolging-survey-${index + 1}`,
          archived: false,
          definitionStatus: "REGISTERED" as const,
          flowStatus: "PINNED" as const,
          warnings: [],
          fields: [
            field(longFieldId),
            ...Array.from({ length: 11 }, (_, fieldIndex) =>
              field(`vurdering-${fieldIndex + 1}`),
            ),
          ],
        })),
      ],
      dimensions: [],
    };
    // Only replace discovery data. Saves and previews still use the mock
    // server's supported source; this fixture does not emulate a compiler.
    catalogReplaced = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: catalog, context: {} }),
    });
  });
  return () => catalogReplaced;
}
