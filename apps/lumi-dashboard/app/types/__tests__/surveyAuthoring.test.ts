import { describe, expect, it } from "vitest";
import {
  CreateSurveyAuthoringProjectSchema,
  FLOATING_PANEL_PRESENTATION,
  isDraftAnswer,
  isRevisionAnswer,
  presentationAsStored,
  SaveSurveyAuthoringDraftSchema,
  SurveyAuthoringProjectAnswerSchema,
  SurveyAuthoringRevisionAnswerSchema,
  type SurveyPresentation,
  SurveyPresentationSchema,
  savedAsSent,
  withPresentation,
  withStoredPresentation,
} from "../surveyAuthoring";

describe("survey authoring input contracts", () => {
  const document = {
    authoringSchemaVersion: 1,
    pages: [
      {
        id: "page-1",
        questions: [
          { id: "rating", type: "rating", prompt: "Hvordan gikk det?" },
        ],
      },
    ],
  };

  it("accepts a V1 authoring document", () => {
    expect(
      CreateSurveyAuthoringProjectSchema.parse({
        team: "team-a",
        name: "Utkast",
        surveyId: "survey-1",
        document,
        presentation: FLOATING_PANEL_PRESENTATION,
      }).document,
    ).toEqual(document);
  });

  it("accepts requests without a presentation from a page opened before the choice existed", () => {
    // Such a page saves its draft without the choice, and the API keeps the
    // stored one. A new project is the floating panel.
    expect(
      CreateSurveyAuthoringProjectSchema.parse({
        team: "team-a",
        name: "Utkast",
        surveyId: "survey-1",
        document,
      }).presentation,
    ).toBeUndefined();
    expect(
      SaveSurveyAuthoringDraftSchema.parse({
        team: "team-a",
        projectId: crypto.randomUUID(),
        expectedVersion: 3,
        name: "Utkast",
        surveyId: "survey-1",
        document,
      }).presentation,
    ).toBeUndefined();
  });

  it("rejects unsupported authoring versions and invalid locks", () => {
    expect(() =>
      CreateSurveyAuthoringProjectSchema.parse({
        team: "team-a",
        name: "Utkast",
        surveyId: "survey-1",
        document: { authoringSchemaVersion: 2 },
      }),
    ).toThrow();

    expect(() =>
      SaveSurveyAuthoringDraftSchema.parse({
        team: "team-a",
        projectId: crypto.randomUUID(),
        expectedVersion: 0,
        name: "Utkast",
        surveyId: "survey-1",
        document,
        presentation: FLOATING_PANEL_PRESENTATION,
      }),
    ).toThrow();
  });
});

describe("survey presentation", () => {
  it("trims the placement note and treats a blank note as no note", () => {
    expect(
      SurveyPresentationSchema.parse({
        mode: "inline",
        placementNote: "  Under resultatlisten  ",
      }),
    ).toEqual({ mode: "inline", placementNote: "Under resultatlisten" });
    expect(
      SurveyPresentationSchema.parse({ mode: "inline", placementNote: "   " }),
    ).toEqual({ mode: "inline", placementNote: null });
    expect(
      SurveyPresentationSchema.parse({ mode: "dock", placementNote: null }),
    ).toEqual(FLOATING_PANEL_PRESENTATION);
  });

  it("rejects an unknown display mode, a long note and a note of several lines", () => {
    expect(() =>
      SurveyPresentationSchema.parse({ mode: "popup", placementNote: null }),
    ).toThrow();
    expect(() =>
      SurveyPresentationSchema.parse({
        mode: "inline",
        placementNote: "a".repeat(201),
      }),
    ).toThrow();
    expect(
      SurveyPresentationSchema.parse({
        mode: "inline",
        placementNote: "a".repeat(200),
      }).placementNote,
    ).toHaveLength(200);
    // The API and the database count characters, not UTF-16 code units.
    expect(
      SurveyPresentationSchema.parse({
        mode: "inline",
        placementNote: "📍".repeat(200),
      }).placementNote,
    ).toBe("📍".repeat(200));
    expect(() =>
      SurveyPresentationSchema.parse({
        mode: "inline",
        placementNote: "📍".repeat(201),
      }),
    ).toThrow();
    expect(() =>
      SurveyPresentationSchema.parse({
        mode: "inline",
        placementNote: "Under\nlisten",
      }),
    ).toThrow();
    expect(() =>
      SurveyPresentationSchema.parse({
        mode: "inline",
        placementNote: "Under\u2028listen",
      }),
    ).toThrow();
  });

  it("saves no placement note for the floating panel", () => {
    // The note describes a place at the content.
    expect(
      SurveyPresentationSchema.parse({
        mode: "dock",
        placementNote: "Under resultatlisten",
      }),
    ).toEqual({ mode: "dock", placementNote: null });
    expect(
      SurveyPresentationSchema.parse({
        mode: "inline",
        placementNote: "Under resultatlisten",
      }),
    ).toEqual({ mode: "inline", placementNote: "Under resultatlisten" });
  });

  it("shows a response without presentation as the floating panel, and says the choice is unknown", () => {
    // An API from before the choice existed sends no presentation.
    const fromOlderApi: { id: string; presentation?: SurveyPresentation } = {
      id: "p1",
    };
    const read = withPresentation(fromOlderApi);
    expect(read).toEqual({
      id: "p1",
      presentation: FLOATING_PANEL_PRESENTATION,
      presentationUnknown: true,
    });
    // Read twice, on the server and in the browser, it stays unknown.
    expect(withPresentation(read)).toEqual(read);

    const inline = { mode: "inline" as const, placementNote: "Under listen" };
    const known = withPresentation({ presentation: inline });
    expect(known.presentation).toBe(inline);
    expect(known).not.toHaveProperty("presentationUnknown");
  });

  it("trims as the API trims: a control character first is kept and rejected, a byte order mark is removed", () => {
    expect(() =>
      SurveyPresentationSchema.parse({
        mode: "inline",
        placementNote: "\u001CUnder listen",
      }),
    ).toThrow("placementNote must be a single line of text");
    expect(
      SurveyPresentationSchema.parse({
        mode: "inline",
        placementNote: "\uFEFF\u3000Under listen\uFEFF",
      }).placementNote,
    ).toBe("Under listen");
  });

  it("rejects half of a surrogate pair, which is no character", () => {
    for (const note of ["a\ud800b", "a\udc00b", "\ude00\ud83d"]) {
      expect(() =>
        SurveyPresentationSchema.parse({ mode: "inline", placementNote: note }),
      ).toThrow("placementNote must be valid Unicode text");
    }
    // A whole pair is one character.
    expect(
      SurveyPresentationSchema.parse({
        mode: "inline",
        placementNote: "Under 😀",
      }).placementNote,
    ).toBe("Under 😀");
  });
});

describe("presentationAsStored", () => {
  it("reads the presentation as the API stores it", () => {
    expect(
      presentationAsStored({ mode: "inline", placementNote: " Under listen " }),
    ).toEqual({ mode: "inline", placementNote: "Under listen" });
    expect(
      presentationAsStored({ mode: "inline", placementNote: "   " }),
    ).toEqual({ mode: "inline", placementNote: null });
    expect(
      presentationAsStored({ mode: "dock", placementNote: "Under listen" }),
    ).toEqual(FLOATING_PANEL_PRESENTATION);
  });

  it("leaves a presentation the API would refuse as it is", () => {
    const long: SurveyPresentation = {
      mode: "inline",
      placementNote: "a".repeat(201),
    };
    expect(presentationAsStored(long)).toBe(long);
  });
});

describe("isDraftAnswer", () => {
  const draft = {
    id: "p1",
    team: "team-a",
    name: "Utkast",
    surveyId: "survey-1",
    document: {
      authoringSchemaVersion: 1,
      pages: [{ id: "side", questions: [] }],
    },
    draftVersion: 2,
  };

  it("knows the draft it asked for", () => {
    expect(isDraftAnswer(draft, "team-a", "p1")).toBe(true);
  });

  it("refuses another draft, a page from a proxy and a draft without pages", () => {
    expect(isDraftAnswer(draft, "team-a", "p2")).toBe(false);
    expect(isDraftAnswer(draft, "team-b", "p1")).toBe(false);
    expect(
      isDraftAnswer(
        new Response("<!doctype html><title>Logg inn</title>", {
          headers: { "content-type": "text/html" },
        }),
        "team-a",
        "p1",
      ),
    ).toBe(false);
    expect(isDraftAnswer(null, "team-a", "p1")).toBe(false);
    expect(isDraftAnswer("<html>", "team-a", "p1")).toBe(false);
    expect(
      isDraftAnswer(
        { ...draft, document: { authoringSchemaVersion: 1, pages: [] } },
        "team-a",
        "p1",
      ),
    ).toBe(false);
    expect(isDraftAnswer({ ...draft, draftVersion: "2" }, "team-a", "p1")).toBe(
      false,
    );
  });
});

describe("isRevisionAnswer", () => {
  const revision = {
    id: "r1",
    projectId: "p1",
    revisionNumber: 1,
    draftVersion: 3,
  };

  it("knows a version shared from the draft", () => {
    expect(isRevisionAnswer(revision, "p1", 3)).toBe(true);
  });

  it("refuses a version of another draft and a page from a proxy", () => {
    expect(isRevisionAnswer(revision, "p2", 3)).toBe(false);
    expect(isRevisionAnswer({ ...revision, id: undefined }, "p1", 3)).toBe(
      false,
    );
    expect(isRevisionAnswer("<html>", "p1", 3)).toBe(false);
  });

  it("refuses a version shared from another draft version", () => {
    expect(isRevisionAnswer(revision, "p1", 4)).toBe(false);
    expect(isRevisionAnswer(revision, "p1", 2)).toBe(false);
  });
});

describe("answers to a write", () => {
  const document = {
    authoringSchemaVersion: 1,
    pages: [{ id: "side", questions: [] }],
  };
  const inline = { mode: "inline", placementNote: "Under listen" };
  const project = {
    id: "p1",
    team: "team-a",
    name: "Utkast",
    surveyId: "survey-1",
    document,
    presentation: inline,
    draftVersion: 2,
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-02T10:00:00Z",
  };
  const revision = {
    id: "r1",
    projectId: "p1",
    revisionNumber: 1,
    draftVersion: 2,
    name: "Utkast",
    surveyId: "survey-1",
    document,
    presentation: inline,
    documentHash: "a",
    definitionHash: "b",
    createdBy: "Z123456",
    createdAt: "2026-11-02T10:00:00Z",
  };

  it("reads a saved draft and a shared version, also from an API from before the choice existed", () => {
    expect(SurveyAuthoringProjectAnswerSchema.parse(project)).toEqual(project);
    expect(SurveyAuthoringRevisionAnswerSchema.parse(revision)).toEqual(
      revision,
    );
    const { presentation: _, ...withoutChoice } = project;
    expect(
      SurveyAuthoringProjectAnswerSchema.parse(withoutChoice).presentation,
    ).toBeUndefined();
  });

  it("refuses an answer that breaks the contract", () => {
    for (const schema of [
      SurveyAuthoringProjectAnswerSchema,
      SurveyAuthoringRevisionAnswerSchema,
    ]) {
      expect(schema.safeParse(null).success).toBe(false);
      expect(schema.safeParse([]).success).toBe(false);
    }
    expect(
      SurveyAuthoringProjectAnswerSchema.safeParse({
        ...project,
        draftVersion: "2",
      }).success,
    ).toBe(false);
    expect(
      SurveyAuthoringRevisionAnswerSchema.safeParse({
        ...revision,
        presentation: { mode: "popup", placementNote: null },
      }).success,
    ).toBe(false);
  });
});

describe("savedAsSent", () => {
  const inline = { mode: "inline" as const, placementNote: "Under listen" };

  it("is true when the server holds the choice that was sent, as the API stores it", () => {
    expect(savedAsSent(inline, { presentation: inline })).toBe(true);
    // The API trims the note, and keeps none for the floating panel.
    expect(
      savedAsSent(
        { mode: "inline", placementNote: "  Under listen " },
        { presentation: inline },
      ),
    ).toBe(true);
    expect(
      savedAsSent(
        { mode: "dock", placementNote: "Under listen" },
        { presentation: FLOATING_PANEL_PRESENTATION },
      ),
    ).toBe(true);
  });

  it("is false when a server from before the choice existed kept the old one", () => {
    // The old server leaves the choice out, and the API keeps the panel.
    expect(
      savedAsSent(inline, { presentation: FLOATING_PANEL_PRESENTATION }),
    ).toBe(false);
    // Or keeps the choice, but not the new note.
    expect(
      savedAsSent(inline, {
        presentation: { mode: "inline", placementNote: "Over listen" },
      }),
    ).toBe(false);
    // An API from before the choice existed says nothing about it.
    const fromOlderApi: { id: string; presentation?: SurveyPresentation } = {
      id: "p1",
    };
    expect(
      savedAsSent(FLOATING_PANEL_PRESENTATION, withPresentation(fromOlderApi)),
    ).toBe(false);
    expect(savedAsSent(FLOATING_PANEL_PRESENTATION, {})).toBe(false);
  });
});

describe("withStoredPresentation", () => {
  const inline = { mode: "inline" as const, placementNote: "Under listen" };

  it("keeps the choice the answer holds", () => {
    expect(
      withStoredPresentation(
        { id: "p1", presentation: FLOATING_PANEL_PRESENTATION },
        inline,
      ),
    ).toEqual({ id: "p1", presentation: FLOATING_PANEL_PRESENTATION });
  });

  it("gives an answer without the choice the stored one, which an API from before the choice existed keeps", () => {
    const fromOlderApi: { id: string; presentation?: SurveyPresentation } = {
      id: "p1",
    };
    const saved = withStoredPresentation(fromOlderApi, inline);
    expect(saved).toEqual({ id: "p1", presentation: inline });
    expect(savedAsSent(inline, saved)).toBe(true);
    expect(savedAsSent(FLOATING_PANEL_PRESENTATION, saved)).toBe(false);

    // The new server marks such an answer before the browser reads it.
    expect(
      withStoredPresentation(withPresentation(fromOlderApi), inline),
    ).toEqual({ id: "p1", presentation: inline });
  });
});
