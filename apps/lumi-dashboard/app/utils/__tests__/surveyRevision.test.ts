import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { describe, expect, it } from "vitest";
import {
  analyticalStructure,
  createRevisionMarkdown,
  describeRevisionChanges,
  serializeSurveyDocumentJson,
  serializeSurveyDocumentTypeScript,
} from "../surveyRevision";

const document: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "opplevelse",
      title: "Opplevelsen",
      questions: [
        {
          id: "rating",
          type: "rating",
          prompt: "Hvordan gikk det?",
          required: true,
        },
      ],
    },
  ],
};

describe("describeRevisionChanges for screens", () => {
  it("describes intro and success screen changes", () => {
    const withIntro: SurveyDocumentV1 = {
      ...document,
      intro: { title: "Velkommen" },
    };
    const withChangedIntro: SurveyDocumentV1 = {
      ...document,
      intro: { title: "Hei!" },
    };
    const withSuccess: SurveyDocumentV1 = {
      ...document,
      success: { title: "Takk!" },
    };

    expect(describeRevisionChanges(withIntro, document)).toContain(
      "Introskjerm er lagt til.",
    );
    expect(describeRevisionChanges(document, withIntro)).toContain(
      "Introskjerm er fjernet.",
    );
    expect(describeRevisionChanges(withChangedIntro, withIntro)).toContain(
      "Introskjermen er endret.",
    );
    expect(describeRevisionChanges(withSuccess, document)).toContain(
      "Bekreftelse etter innsending er lagt til.",
    );
    expect(describeRevisionChanges(document, withSuccess)).toContain(
      "Bekreftelse etter innsending er fjernet.",
    );
  });
});

describe("survey revision exports", () => {
  it("serializes deterministic JSON and TypeScript", () => {
    const json = serializeSurveyDocumentJson(document);
    expect(JSON.parse(json)).toEqual(document);
    expect(json.indexOf("authoringSchemaVersion")).toBeLessThan(
      json.indexOf("pages"),
    );
    const reorderedKeys = {
      pages: document.pages,
      type: document.type,
      authoringSchemaVersion: 1,
    } as SurveyDocumentV1;
    expect(serializeSurveyDocumentJson(reorderedKeys)).toBe(json);

    const typescript = serializeSurveyDocumentTypeScript(document);
    expect(typescript).toContain(
      'import type { SurveyDocumentV1 } from "@navikt/lumi-survey";',
    );
    expect(typescript).toContain("satisfies SurveyDocumentV1;");
    expect(typescript).toContain(json.trim());
  });

  it("normalizes analytical order and rating defaults", () => {
    const reordered: SurveyDocumentV1 = {
      ...document,
      pages: [
        {
          ...document.pages[0],
          questions: [
            {
              id: "rating",
              type: "rating",
              prompt: "Hvordan gikk det?",
              required: true,
              variant: "emoji",
            },
          ],
        },
      ],
    };
    expect(analyticalStructure(reordered)).toBe(analyticalStructure(document));
  });

  it("describes content changes without treating them as publication state", () => {
    const changed: SurveyDocumentV1 = {
      ...document,
      pages: [
        {
          ...document.pages[0],
          title: "Ny sidetittel",
          questions: [
            {
              ...document.pages[0].questions[0],
              prompt: "Hvordan opplevde du dette?",
            },
          ],
        },
      ],
    };

    expect(describeRevisionChanges(changed, document)).toEqual([
      "Tittel eller beskrivelse er endret på 1 side(r).",
      "Teksten er endret i 1 spørsmål.",
    ]);
    expect(describeRevisionChanges(document)).toEqual([
      "Første delbare revisjon i prosjektet.",
    ]);
  });

  it("creates a portable markdown link", () => {
    const revision = {
      id: "00000000-0000-0000-0000-000000000001",
      projectId: "00000000-0000-0000-0000-000000000002",
      revisionNumber: 3,
      draftVersion: 7,
      name: "Kvittering",
      surveyId: "kvittering-v1",
      document,
      documentHash: "a".repeat(64),
      definitionHash: "b".repeat(64),
      createdBy: "A123456",
      createdAt: "2026-08-16T12:00:00Z",
    };
    const markdown = createRevisionMarkdown(
      revision,
      "https://lumi.example/revision/1",
    );

    expect(markdown).toBe(
      "[Kvittering – revisjon 3](https://lumi.example/revision/1)",
    );
    expect(
      createRevisionMarkdown(
        { ...revision, name: "Kvittering [beta]" },
        "https://lumi.example/revision/1",
      ),
    ).toBe(
      "[Kvittering \\[beta\\] – revisjon 3](https://lumi.example/revision/1)",
    );
  });
});
