import { act, render } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LumiSurveyInline as ClientEntryInline,
  type LumiSurveyInlineProps as ClientEntryInlineProps,
} from "../../../client.js";
import {
  DEFAULT_SURVEY_RATING,
  type LumiSurveyBehavior,
  type LumiSurveyEvents,
  LumiSurveyInline,
  type LumiSurveyInlineBehavior,
  type LumiSurveyInlineProps,
  type LumiSurveyInlineStyle,
  type LumiSurveyLabels,
  type SurveyDocumentV1,
} from "../../../index.js";

const survey = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "side",
      questions: [
        {
          id: "rating",
          type: "rating",
          variant: "thumbs",
          prompt: "Var dette nyttig?",
          required: true,
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;

const transport = { endpoint: "/api/lumi/feedback" };

describe("LumiSurveyInline public contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is exported from the main entry and from the client entry", () => {
    expect(LumiSurveyInline.displayName).toBe("LumiSurveyInline");
    expect(ClientEntryInline).toBe(LumiSurveyInline);
    const props: ClientEntryInlineProps = {
      surveyId: "kontrakt",
      survey,
      transport,
    } satisfies LumiSurveyInlineProps;
    expect(props.surveyId).toBe("kontrakt");
  });

  it("takes the three required props and renders", () => {
    const { container } = render(
      <LumiSurveyInline
        surveyId="kontrakt"
        survey={survey}
        transport={transport}
      />,
    );

    expect(container.querySelector(".lumi-survey-inline")).not.toBeNull();
  });

  it("renders nothing on the server, where the viewport and the device are unknown", () => {
    const html = renderToString(
      <LumiSurveyInline
        surveyId="kontrakt"
        survey={survey}
        transport={transport}
      />,
    );

    expect(html).toBe("");
  });

  it("appears after hydration, without a hydration mismatch", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const element = (
      <main>
        <h1>Side fra serveren</h1>
        <LumiSurveyInline
          surveyId="kontrakt"
          survey={survey}
          transport={transport}
        />
      </main>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.append(container);
    expect(container.querySelector(".lumi-survey-inline")).toBeNull();

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, element);
    });

    expect(container.querySelector(".lumi-survey-inline")).not.toBeNull();
    expect(error).not.toHaveBeenCalled();

    act(() => root?.unmount());
    container.remove();
  });

  it("types the options an inline survey has", () => {
    const behavior = {
      questionLayout: "singlePage",
      showProgress: true,
      showPersonalDataNotice: true,
      personalDataNotice: "Ikke skriv personopplysninger.",
      collectLocation: false,
      initialPageId: "side",
    } satisfies LumiSurveyInlineBehavior;
    const style = {
      containerClassName: "beholder",
      panelClassName: "panel",
      panelBackground: "neutral-soft",
      panelBorderColor: "neutral-subtle",
    } satisfies LumiSurveyInlineStyle;
    const events: LumiSurveyEvents = { onViewDock: vi.fn() };
    // A label object shared with the dock can be passed as it is.
    const sharedLabels: LumiSurveyLabels = {
      submit: "Send inn",
      cancel: "Lukk",
    };

    const props: LumiSurveyInlineProps = {
      surveyId: "kontrakt",
      survey,
      transport: { submit: async () => undefined },
      behavior,
      style,
      events,
      labels: sharedLabels,
      intro: { title: "Velkommen" },
      success: { title: "Takk", body: "Vi leser alt." },
      context: { tags: { surface: "inline", placement: "under-resultat" } },
      lang: "nb",
      headingLevel: "3",
    };

    expect(props.headingLevel).toBe("3");
  });

  it("rejects the options that only make sense for the dock", () => {
    const dockOnly: LumiSurveyInlineProps[] = [
      {
        surveyId: "kontrakt",
        survey,
        transport,
        // @ts-expect-error An inline survey stores nothing.
        behavior: { storageStrategy: "localStorage" },
      },
      {
        surveyId: "kontrakt",
        survey,
        transport,
        // @ts-expect-error An inline survey is always shown.
        behavior: { initialOpen: false },
      },
      {
        surveyId: "kontrakt",
        survey,
        transport,
        // @ts-expect-error There is no dismissal to wait out.
        behavior: { dismissCooldownDays: 7 },
      },
      {
        surveyId: "kontrakt",
        survey,
        transport,
        // @ts-expect-error "steps" exists for flat legacy surveys only.
        behavior: { questionLayout: "steps" },
      },
      {
        surveyId: "kontrakt",
        survey,
        transport,
        // @ts-expect-error The app places the survey, not the widget.
        style: { position: "bottom-left" },
      },
      {
        surveyId: "kontrakt",
        survey,
        transport,
        // @ts-expect-error The receipt does not close.
        success: { autoClose: true },
      },
      {
        surveyId: "kontrakt",
        survey,
        transport,
        // @ts-expect-error There is no close button to label.
        labels: { cancel: "Avbryt" },
      },
      {
        surveyId: "kontrakt",
        survey,
        transport,
        // @ts-expect-error Level 6 leaves no level for the questions below.
        headingLevel: "6",
      },
      {
        surveyId: "kontrakt",
        // @ts-expect-error The flat legacy configuration is not accepted.
        survey: DEFAULT_SURVEY_RATING,
        transport,
      },
    ];
    // The dock's own behavior type has fields an inline survey does not.
    const dockBehavior: LumiSurveyBehavior = { questionLayout: "steps" };
    // @ts-expect-error A dock behavior object is not an inline behavior.
    const inlineBehavior: LumiSurveyInlineBehavior = dockBehavior;

    expect(dockOnly).toHaveLength(9);
    expect(inlineBehavior).toBe(dockBehavior);
  });
});
