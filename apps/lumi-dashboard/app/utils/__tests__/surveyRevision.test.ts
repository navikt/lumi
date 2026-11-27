import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { describe, expect, it } from "vitest";
import type { SurveyPresentation } from "~/types/surveyAuthoring";
import {
  analyticalStructure,
  createRevisionMarkdown,
  describeRevisionChanges,
  inlineContextTags,
  previewContextTags,
  serializeSurveyDocumentJson,
  serializeSurveyDocumentTypeScript,
  serializeSurveyEmbedExample,
} from "../surveyRevision";

const FLOATING_PANEL: SurveyPresentation = {
  mode: "dock",
  placementNote: null,
};

/** What a shared version holds: the document and where it is shown. */
const shared = (
  document: SurveyDocumentV1,
  presentation: SurveyPresentation = FLOATING_PANEL,
) => ({ document, presentation });

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

    expect(
      describeRevisionChanges(shared(withIntro), shared(document)),
    ).toContain("Velkomstside er lagt til.");
    expect(
      describeRevisionChanges(shared(document), shared(withIntro)),
    ).toContain("Velkomstside er fjernet.");
    expect(
      describeRevisionChanges(shared(withChangedIntro), shared(withIntro)),
    ).toContain("Velkomstsiden er endret.");
    expect(
      describeRevisionChanges(shared(withSuccess), shared(document)),
    ).toContain("Bekreftelse etter innsending er lagt til.");
    expect(
      describeRevisionChanges(shared(document), shared(withSuccess)),
    ).toContain("Bekreftelse etter innsending er fjernet.");
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

  it("treats the multi-choice limit as analysis structure", () => {
    const withLimit = (maxSelections: number): SurveyDocumentV1 => ({
      authoringSchemaVersion: 1,
      type: "custom",
      pages: [
        {
          id: "valg",
          questions: [
            {
              id: "prioriteringer",
              type: "multiChoice",
              prompt: "Hva er viktigst?",
              options: [
                { value: "a", label: "A" },
                { value: "b", label: "B" },
              ],
              maxSelections,
            },
          ],
        },
      ],
    });

    expect(analyticalStructure(withLimit(1))).not.toBe(
      analyticalStructure(withLimit(2)),
    );
    const base = withLimit(1);
    const baseQuestion = base.pages[0].questions[0];
    if (baseQuestion.type !== "multiChoice") {
      throw new Error("Testoppsettet må inneholde et flervalgsspørsmål");
    }
    const presentationChanged: SurveyDocumentV1 = {
      ...base,
      pages: [
        {
          ...base.pages[0],
          questions: [
            {
              ...baseQuestion,
              randomize: true,
              variant: "combobox",
            },
          ],
        },
      ],
    };
    expect(analyticalStructure(presentationChanged)).toBe(
      analyticalStructure(base),
    );
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

    expect(describeRevisionChanges(shared(changed), shared(document))).toEqual([
      "Tittel eller beskrivelse er endret på 1 side(r).",
      "Teksten er endret i 1 spørsmål.",
    ]);
    expect(describeRevisionChanges(shared(document))).toEqual([
      "Første delte versjon i prosjektet.",
    ]);
  });

  it("creates a portable markdown link", () => {
    const revision = {
      id: "00000000-0000-4000-8000-000000000001",
      projectId: "00000000-0000-4000-8000-000000000002",
      revisionNumber: 3,
      draftVersion: 7,
      name: "Kvittering",
      surveyId: "kvittering-v1",
      document,
      presentation: FLOATING_PANEL,
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
      "[Kvittering – versjon 3](https://lumi.example/revision/1)",
    );
    expect(
      createRevisionMarkdown(
        { ...revision, name: "Kvittering [beta]" },
        "https://lumi.example/revision/1",
      ),
    ).toBe(
      "[Kvittering \\[beta\\] – versjon 3](https://lumi.example/revision/1)",
    );
  });
});

describe("describeRevisionChanges for the presentation", () => {
  const atContent = (placementNote: string | null): SurveyPresentation => ({
    mode: "inline",
    placementNote,
  });

  it("describes a survey that is moved without a single question changing", () => {
    expect(
      describeRevisionChanges(
        shared(document, atContent("Under resultatlisten")),
        shared(document),
      ),
    ).toEqual([
      "Visningen er endret fra «Flytende panel» til «Ved innholdet».",
      "Plasseringsbeskrivelsen «Under resultatlisten» er lagt til.",
    ]);
  });

  it("describes a placement note that is changed or removed", () => {
    expect(
      describeRevisionChanges(
        shared(document, atContent("Under kalkulatoren")),
        shared(document, atContent("Under resultatlisten")),
      ),
    ).toEqual([
      "Plasseringsbeskrivelsen er endret fra «Under resultatlisten» til «Under kalkulatoren».",
    ]);
    expect(
      describeRevisionChanges(
        shared(document, atContent(null)),
        shared(document, atContent("Under resultatlisten")),
      ),
    ).toEqual(["Plasseringsbeskrivelsen «Under resultatlisten» er fjernet."]);
  });

  it("says that nothing changed when neither the document nor the presentation did", () => {
    expect(
      describeRevisionChanges(
        shared(document, atContent("Under resultatlisten")),
        shared(document, atContent(" Under resultatlisten ")),
      ),
    ).toEqual(["Ingen semantiske endringer oppdaget."]);
  });

  it("lists a moved survey together with changes in the document", () => {
    const changed: SurveyDocumentV1 = {
      ...document,
      pages: [{ ...document.pages[0], title: "Hvordan gikk det?" }],
    };

    expect(
      describeRevisionChanges(
        shared(changed, atContent(null)),
        shared(document),
      ),
    ).toEqual([
      "Visningen er endret fra «Flytende panel» til «Ved innholdet».",
      "Tittel eller beskrivelse er endret på 1 side(r).",
    ]);
  });

  it("says nothing about the presentation of a version an API from before the choice sent", () => {
    const unknown = {
      ...shared(document),
      presentationUnknown: true,
    };
    const notCompared =
      "Visningen kunne ikke hentes, så den er ikke sammenlignet.";
    expect(
      describeRevisionChanges(
        shared(document, atContent("Under resultatlisten")),
        unknown,
      ),
    ).toEqual([`Ingen endringer i surveydokumentet. ${notCompared}`]);
    const changed: SurveyDocumentV1 = {
      ...document,
      pages: [{ ...document.pages[0], title: "Hvordan gikk det?" }],
    };
    expect(
      describeRevisionChanges(
        { ...shared(changed), presentationUnknown: true },
        shared(document, atContent("Under resultatlisten")),
      ),
    ).toEqual([
      "Tittel eller beskrivelse er endret på 1 side(r).",
      notCompared,
    ]);
  });
});

describe("describeRevisionChanges for the order of pages", () => {
  const page = (id: string): SurveyDocumentV1["pages"][number] => ({
    id,
    questions: [
      { id: `sporsmal-${id}`, type: "text", prompt: "Hva tenker du?" },
    ] as SurveyDocumentV1["pages"][number]["questions"],
  });

  it("tells that the pages have changed places, also when an id holds the character between ids", () => {
    const before: SurveyDocumentV1 = {
      ...document,
      pages: [page("a"), page("a|a")],
    };
    const after: SurveyDocumentV1 = {
      ...document,
      pages: [page("a|a"), page("a")],
    };

    expect(describeRevisionChanges(shared(after), shared(before))).toEqual([
      "Rekkefølgen på sidene er endret.",
    ]);
  });
});

describe("serializeSurveyEmbedExample", () => {
  it("uses the floating panel and the lowest version the example runs on", () => {
    const example = serializeSurveyEmbedExample({
      surveyId: "kvittering-v1",
      presentation: FLOATING_PANEL,
    });

    // `transport={{ endpoint }}` came in 2.5.0, after the document format.
    expect(example).toContain('transport={{ endpoint: "/api/lumi/feedback" }}');
    expect(example).toContain(
      "// Krever @navikt/lumi-survey 2.5.0 eller nyere.",
    );
    expect(example).toContain(
      'import { LumiSurveyDock } from "@navikt/lumi-survey/client";',
    );
    expect(example).toContain(
      '    <LumiSurveyDock\n      surveyId="kvittering-v1"',
    );
    expect(example).not.toContain("LumiSurveyInline");
    expect(example).not.toContain("context=");
  });

  it("uses the inline component, its lowest version and tags for the placement", () => {
    const example = serializeSurveyEmbedExample({
      surveyId: "kalkulator-v1",
      presentation: {
        mode: "inline",
        placementNote: "Under resultatlisten på Min side",
      },
    });

    expect(example).toContain(
      "// Krever @navikt/lumi-survey 2.6.0 eller nyere.",
    );
    expect(example).toContain(
      'import { LumiSurveyInline } from "@navikt/lumi-survey/client";',
    );
    expect(example).toContain(
      "    // Plassering: Under resultatlisten på Min side",
    );
    // The tag is a short, fixed name, so the places can be told apart.
    expect(example).toContain(
      'context={{ tags: { surface: "inline", placement: "under-resultatlisten-pa-min-side" } }}',
    );
    expect(example).not.toContain("LumiSurveyDock");
  });

  it("keeps the placement tag short enough for Lumi API, cut at a whole word", () => {
    const tagOf = (placementNote: string) =>
      serializeSurveyEmbedExample({
        surveyId: "kalkulator-v1",
        presentation: { mode: "inline", placementNote },
      }).match(/placement: "([^"]*)"/)?.[1];

    // 200 characters is the longest note. The API takes tag values up to 100.
    const longNote = "Under resultatlisten på siden for sykmeldte "
      .repeat(5)
      .slice(0, 200);
    expect(tagOf(longNote)).toBe(
      "under-resultatlisten-pa-siden-for-sykmeldte-under",
    );
    // A note without a word break is cut where the limit is.
    expect(tagOf("æ".repeat(200))).toBe("ae".repeat(30));
    // A note that fits is not touched, also when it ends at the limit.
    expect(tagOf("a".repeat(60))).toBe("a".repeat(60));
    expect(tagOf(`${"a".repeat(60)} b`)).toBe("a".repeat(60));
    // A note with nothing to make a name from gives no tag.
    expect(tagOf("«…»")).toBeUndefined();
  });

  it("leaves the placement tag out when there is no note", () => {
    const example = serializeSurveyEmbedExample({
      surveyId: "kalkulator-v1",
      presentation: { mode: "inline", placementNote: "  " },
    });

    expect(example).toContain('context={{ tags: { surface: "inline" } }}');
    expect(example).not.toContain("Plassering:");
  });

  it("writes a survey id with quotes or braces as an expression", () => {
    const example = serializeSurveyEmbedExample({
      surveyId: 'min "survey" {1}',
      presentation: FLOATING_PANEL,
    });

    expect(example).toContain('surveyId={"min \\"survey\\" {1}"}');
  });

  it("writes a survey id with an entity as an expression, so JSX does not decode it", () => {
    // In a quoted JSX attribute `&amp;` is read as `&`, which is another id.
    const example = serializeSurveyEmbedExample({
      surveyId: "valg&amp;svar",
      presentation: FLOATING_PANEL,
    });

    expect(example).toContain('surveyId={"valg&amp;svar"}');
    expect(example).not.toContain('surveyId="valg');
  });

  it("imports from the entry that also works in a server component, and says when it does not", () => {
    // The main entry has no "use client". Rendered from a server component
    // in the Next.js App Router, it fails.
    for (const presentation of [
      FLOATING_PANEL,
      { mode: "inline" as const, placementNote: null },
    ]) {
      const example = serializeSurveyEmbedExample({
        surveyId: "kalkulator-v1",
        presentation,
      });
      expect(example).toMatch(/from "@navikt\/lumi-survey\/client";\n/);
      expect(example).toContain(
        '// Med "moduleResolution": "node" i tsconfig: importer fra "@navikt/lumi-survey" i en fil med "use client" øverst.',
      );
      // There, TypeScript wants a relative import with its file extension.
      expect(example).toContain(
        '// Med "node16" eller "nodenext" i et ESM-prosjekt: importer fra "./survey.js".',
      );
      expect(example).toContain('import { survey } from "./survey";');
    }
  });

  it("gives the previews the tags of the example at the content, and only the environment for the panel", () => {
    expect(
      previewContextTags("survey-workshop-editor", {
        mode: "inline",
        placementNote: "Under resultatlisten",
      }),
    ).toEqual({
      environment: "survey-workshop-editor",
      surface: "inline",
      placement: "under-resultatlisten",
    });
    expect(
      previewContextTags("survey-workshop-editor", FLOATING_PANEL),
    ).toEqual({ environment: "survey-workshop-editor" });
  });

  it("gives the previews the tags of the example", () => {
    expect(
      inlineContextTags({
        mode: "inline",
        placementNote: " Under resultatlisten ",
      }),
    ).toEqual({ surface: "inline", placement: "under-resultatlisten" });
    expect(inlineContextTags({ mode: "inline", placementNote: null })).toEqual({
      surface: "inline",
    });
  });
});
