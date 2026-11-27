import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { describe, expect, it } from "vitest";
import { computeLiveVisibility } from "../liveVisibility";

const byTag = (id: string, key: string, value: string) => ({
  id,
  type: "text" as const,
  prompt: `Vises når ${key} er ${value}`,
  visibleIf: {
    field: "METADATA" as const,
    key,
    operator: "EQ" as const,
    value,
  },
});

const document: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  pages: [
    {
      id: "side",
      questions: [
        {
          id: "valg",
          type: "singleChoice",
          prompt: "Fant du det?",
          options: [
            { value: "ja", label: "Ja" },
            { value: "nei", label: "Nei" },
          ],
        },
        {
          id: "hvorfor",
          type: "text",
          prompt: "Hva manglet?",
          visibleIf: { questionId: "valg", operator: "EQ", value: "nei" },
        },
        byTag("flate", "surface", "inline"),
        byTag("sted", "placement", "under-resultatlisten"),
        byTag("miljo", "environment", "survey-workshop-editor"),
      ],
    },
  ],
};

const atTheContent = {
  mode: "inline" as const,
  placementNote: "Under resultatlisten",
};
const asPanel = { mode: "dock" as const, placementNote: null };

describe("computeLiveVisibility", () => {
  it("evaluates the conditions with the tags the preview at the content has", () => {
    const visibility = computeLiveVisibility(
      document,
      {},
      "survey-workshop-editor",
      atTheContent,
    );

    expect(Object.fromEntries(visibility)).toEqual({
      hvorfor: false,
      flate: true,
      sted: true,
      miljo: true,
    });
  });

  it("evaluates them with only the environment for the floating panel", () => {
    const visibility = computeLiveVisibility(
      document,
      {},
      "survey-workshop-editor",
      asPanel,
    );

    expect(Object.fromEntries(visibility)).toEqual({
      hvorfor: false,
      flate: false,
      sted: false,
      miljo: true,
    });
  });

  it("follows the answers in the preview, and a changed placement", () => {
    const visibility = computeLiveVisibility(
      document,
      { valg: "nei" },
      "survey-workshop-editor",
      { mode: "inline", placementNote: "Over kalkulatoren" },
    );

    expect(visibility.get("hvorfor")).toBe(true);
    expect(visibility.get("flate")).toBe(true);
    expect(visibility.get("sted")).toBe(false);
  });

  it("evaluates the device type from the width of the page in the preview", () => {
    const byDevice: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "side",
          questions: [
            byTag("mobil", "deviceType", "mobile"),
            byTag("nettbrett", "deviceType", "tablet"),
            byTag("pc", "deviceType", "desktop"),
          ],
        },
      ],
    };
    const at = (width?: number) =>
      Object.fromEntries(
        computeLiveVisibility(
          byDevice,
          {},
          "survey-workshop-editor",
          atTheContent,
          width === undefined ? undefined : { width, height: 700 },
        ),
      );

    expect(at(360)).toEqual({ mobil: true, nettbrett: false, pc: false });
    expect(at(800)).toEqual({ mobil: false, nettbrett: true, pc: false });
    expect(at(1200)).toEqual({ mobil: false, nettbrett: false, pc: true });
    // Until the preview has measured its page, no device type is known.
    expect(at()).toEqual({ mobil: false, nettbrett: false, pc: false });
  });

  it("hides a follow-up when the placement hides the question it follows, also with the answer kept", () => {
    const followUp: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      pages: [
        {
          id: "side",
          questions: [
            {
              id: "fant",
              type: "singleChoice",
              prompt: "Fant du det du lette etter?",
              options: [
                { value: "ja", label: "Ja" },
                { value: "nei", label: "Nei" },
              ],
              visibleIf: {
                field: "METADATA",
                key: "placement",
                operator: "EQ",
                value: "under-resultatlisten",
              },
            },
            {
              id: "hva",
              type: "text",
              prompt: "Hva fant du?",
              visibleIf: { questionId: "fant", operator: "EQ", value: "ja" },
            },
          ],
        },
      ],
    };
    // The preview keeps the answer of a question that is hidden.
    const answers = { fant: "ja" };

    expect(
      Object.fromEntries(
        computeLiveVisibility(
          followUp,
          answers,
          "survey-workshop-editor",
          atTheContent,
        ),
      ),
    ).toEqual({ fant: true, hva: true });
    expect(
      Object.fromEntries(
        computeLiveVisibility(followUp, answers, "survey-workshop-editor", {
          mode: "inline",
          placementNote: "Over kalkulatoren",
        }),
      ),
    ).toEqual({ fant: false, hva: false });
  });
});
