import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LumiSurveyEndpoint,
  LumiSurveyTransport,
} from "../../../core/types.js";
import { createRatingSurvey } from "../../../presets/index.js";
import { LumiSurveyDock } from "../LumiSurveyDock.js";

const SURVEY_ID = "endpoint-transport";

const survey = createRatingSurvey({ ratingPrompt: "Hvor fornøyd er du?" });

const dock = () => document.querySelector(`[data-feedback-id="${SURVEY_ID}"]`);

function renderDock(transport: LumiSurveyTransport | LumiSurveyEndpoint) {
  return render(
    <LumiSurveyDock
      surveyId={SURVEY_ID}
      survey={survey}
      transport={transport}
      behavior={{ storageStrategy: "none" }}
    />,
  );
}

async function submitRating() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: /5\./i }));
  await user.click(screen.getByRole("button", { name: "Send" }));
}

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
    renderDock({ endpoint: "/api/lumi/feedback" });

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
    renderDock({ endpoint: "https://lumi-api.example/api/v1/feedback" });

    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(error.mock.calls[0]?.[0]).toContain(
      "[Lumi] The survey is not shown",
    );
    expect(dock()).toBeNull();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("renders nothing when the transport is missing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderDock(undefined as unknown as LumiSurveyEndpoint);

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("transport is missing"),
      ),
    );
    expect(dock()).toBeNull();
  });

  it("uses submit when the transport has both submit and endpoint", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    renderDock({ endpoint: "/api", submit } as unknown as LumiSurveyTransport);

    await submitRating();

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
