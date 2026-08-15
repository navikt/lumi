import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSearchParams } from "~/hooks/useSearchParams";
import type { FeedbackStats } from "~/hooks/useStats";
import { useStats } from "~/hooks/useStats";
import { DeviceBreakdownChart } from "../DeviceBreakdownChart";

vi.mock("~/hooks/useStats", () => ({
  useStats: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(),
}));

const mockUseStats = vi.mocked(useStats);
const mockUseSearchParams = vi.mocked(useSearchParams);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSearchParams.mockReturnValue({ setParams: vi.fn() } as never);
});

function givenStats(stats: Partial<FeedbackStats>) {
  mockUseStats.mockReturnValue({
    data: stats as FeedbackStats,
    isPending: false,
  } as never);
}

describe("DeviceBreakdownChart", () => {
  it("shows coarse screen resolution groups without exposing exact values", () => {
    givenStats({
      surveyType: "rating",
      byRating: { "4": 6 },
      byDevice: { desktop: { count: 6, averageRating: 4 } },
      byScreenResolution: {
        "1280-1919": 2,
        "1920-2559": 4,
      },
    });

    render(<DeviceBreakdownChart showScreenResolution />);

    expect(screen.getByText("Skjermstørrelse")).toBeInTheDocument();
    expect(screen.getByText("1280–1919 px")).toBeInTheDocument();
    expect(screen.getByText("1920–2559 px")).toBeInTheDocument();
    expect(screen.queryByText(/1920×1080/)).not.toBeInTheDocument();
  });

  it("can omit screen resolution groups in compact overview cards", () => {
    givenStats({
      byDevice: { mobile: { count: 5, averageRating: 0 } },
      byScreenResolution: { "under-1280": 5 },
    });

    render(<DeviceBreakdownChart showScreenResolution={false} />);

    expect(screen.queryByText("Skjermstørrelse")).not.toBeInTheDocument();
  });
});
