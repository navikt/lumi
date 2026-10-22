import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LumiSurveyEndpoint,
  LumiSurveyEvents,
  LumiSurveyTransport,
} from "../../../core/types.js";
import { createRatingSurvey } from "../../../presets/index.js";
import { LumiSurveyDock } from "../LumiSurveyDock.js";

const SURVEY_ID = "endpoint-transport";
const VALID_ENDPOINT = { endpoint: "/api/lumi/feedback" };
const OTHER_ORIGIN = { endpoint: "https://lumi-api.example/api/v1/feedback" };

const survey = createRatingSurvey({ ratingPrompt: "Hvor fornøyd er du?" });

const dock = () => document.querySelector(`[data-feedback-id="${SURVEY_ID}"]`);

function dockElement(
  transport: LumiSurveyTransport | LumiSurveyEndpoint,
  {
    surveyId = SURVEY_ID,
    events,
  }: { surveyId?: string; events?: LumiSurveyEvents } = {},
) {
  return (
    <LumiSurveyDock
      surveyId={surveyId}
      survey={survey}
      transport={transport}
      events={events}
      behavior={{ storageStrategy: "none" }}
    />
  );
}

function renderDock(transport: LumiSurveyTransport | LumiSurveyEndpoint) {
  return render(dockElement(transport));
}

async function submitRating() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: /5\./i }));
  await user.click(screen.getByRole("button", { name: "Send" }));
}

const notShownErrors = (error: { mock: { calls: unknown[][] } }) =>
  error.mock.calls.filter(([message]) =>
    String(message).includes("[Lumi] The survey is not shown"),
  );

describe("LumiSurveyDock with transport={{ endpoint }}", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the answers to the endpoint itself", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    renderDock(VALID_ENDPOINT);

    await submitRating();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${window.location.origin}/api/lumi/feedback`);
    expect(JSON.parse(init.body as string)).toMatchObject({
      schemaVersion: 2,
      surveyId: SURVEY_ID,
    });
  });

  it("renders nothing and logs one error for an endpoint on another origin", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // The same dock with a valid endpoint proves it has finished loading, so
    // the empty result below is not just a dock that is still loading.
    const { rerender } = renderDock(VALID_ENDPOINT);
    expect(
      await screen.findByRole("radio", { name: /5\./i }),
    ).toBeInTheDocument();

    rerender(dockElement(OTHER_ORIGIN));

    expect(dock()).toBeNull();
    expect(notShownErrors(error)).toHaveLength(1);
    expect(String(notShownErrors(error)[0]?.[0])).toContain(
      "not on the page's own origin",
    );
  });

  it("shows the survey once the endpoint becomes valid", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = renderDock({ endpoint: "" });

    rerender(dockElement(VALID_ENDPOINT));

    expect(
      await screen.findByRole("radio", { name: /5\./i }),
    ).toBeInTheDocument();
    expect(notShownErrors(error)).toHaveLength(1);
  });

  it.each([
    ["missing", undefined, "transport is missing"],
    ["a string", "/api/lumi/feedback", "got a string"],
  ])(
    "renders nothing when the transport is %s",
    async (_name, transport, problem) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { rerender } = renderDock(VALID_ENDPOINT);
      expect(
        await screen.findByRole("radio", { name: /5\./i }),
      ).toBeInTheDocument();

      rerender(dockElement(transport as unknown as LumiSurveyEndpoint));

      expect(dock()).toBeNull();
      expect(error).toHaveBeenCalledWith(expect.stringContaining(problem));
    },
  );

  it("logs the problem once in StrictMode", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<StrictMode>{dockElement(OTHER_ORIGIN)}</StrictMode>);

    await waitFor(() => expect(notShownErrors(error)).toHaveLength(1));
    // StrictMode runs the effect twice on mount. Let the hidden dock finish
    // loading and render again before counting.
    render(
      <StrictMode>
        {dockElement(VALID_ENDPOINT, { surveyId: "control" })}
      </StrictMode>,
    );
    expect(
      await screen.findByRole("radio", { name: /5\./i }),
    ).toBeInTheDocument();
    expect(notShownErrors(error)).toHaveLength(1);
  });

  it("does not count a view of a dock that renders nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onViewDock = vi.fn();

    // The hidden dock comes first, so it has finished loading by the time
    // the control dock counts its view.
    render(
      <>
        {dockElement(OTHER_ORIGIN, { events: { onViewDock } })}
        {dockElement(VALID_ENDPOINT, {
          surveyId: "control",
          events: { onViewDock },
        })}
      </>,
    );

    await waitFor(() => expect(onViewDock).toHaveBeenCalledWith("control"));
    expect(onViewDock).not.toHaveBeenCalledWith(SURVEY_ID);
  });

  it("uses submit when the transport has both submit and endpoint", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    renderDock({ endpoint: "/api", submit } as unknown as LumiSurveyTransport);

    await submitRating();

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
