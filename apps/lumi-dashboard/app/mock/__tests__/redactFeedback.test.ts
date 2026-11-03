// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { textRedactionHash } from "~/utils/textRedaction";
import {
  createContext,
  createRatingAnswer,
  createTextAnswer,
} from "../helpers";
import { mockFeedbackItems, redactMockFeedback } from "../mockData";

const id = "masking-mock-test";
afterEach(() => {
  const index = mockFeedbackItems.findIndex((item) => item.id === id);
  if (index >= 0) mockFeedbackItems.splice(index, 1);
});
async function fixture() {
  const text = "God hjelp. Hilsen Ola";
  const item = {
    id,
    submittedAt: new Date().toISOString(),
    app: "nav-no-frontend",
    surveyId: "masking-test",
    context: createContext("/test", "desktop"),
    answers: [
      createRatingAnswer("rating", "Rating", 4),
      createTextAnswer("comment", "Kommentar", text),
    ],
    sensitiveDataRedacted: false,
  };
  mockFeedbackItems.push(item);
  return {
    item,
    input: {
      id,
      team: "team-esyfo",
      fieldId: "comment",
      expectedTextHash: await textRedactionHash(text),
      ranges: [{ start: text.indexOf("Ola"), end: text.length }],
    },
  };
}
describe("mock masking matches API behavior", () => {
  it("preserves the other answers and rejects a concurrent stale selection", async () => {
    const { item, input } = await fixture();
    const outcomes = await Promise.allSettled([
      redactMockFeedback(input),
      redactMockFeedback(input),
    ]);
    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: { error: { status: 409 } } });
    expect(item.answers[1].value).toEqual({
      type: "text",
      text: "God hjelp. Hilsen [TEKST FJERNET]",
    });
    expect(item.answers[0].fieldType).toBe("RATING");
    expect(item.sensitiveDataRedacted).toBe(true);
  });
  it("refuses another team and a non-text field without modifying anything", async () => {
    const { item, input } = await fixture();
    await expect(
      redactMockFeedback({ ...input, team: "other-team" }),
    ).rejects.toMatchObject({ error: { status: 404 } });
    await expect(
      redactMockFeedback({ ...input, fieldId: "rating" }),
    ).rejects.toMatchObject({ error: { status: 400 } });
    expect(item.sensitiveDataRedacted).toBe(false);
  });
});
