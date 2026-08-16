import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UndoNotice } from "~/components/surveyverksted/UndoNotice";

describe("UndoNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("focuses the undo button on mount", () => {
    render(
      <UndoNotice label="Slettet." onUndo={() => {}} onExpire={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Angre" })).toHaveFocus();
  });

  it("does not expire while the undo button keeps focus", () => {
    const onExpire = vi.fn();
    render(
      <UndoNotice label="Slettet." onUndo={() => {}} onExpire={onExpire} />,
    );
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("expires after the timeout once focus has left", () => {
    const onExpire = vi.fn();
    render(
      <>
        <UndoNotice label="Slettet." onUndo={() => {}} onExpire={onExpire} />
        <button type="button">Utenfor</button>
      </>,
    );
    const outside = screen.getByRole("button", { name: "Utenfor" });
    fireEvent.blur(screen.getByRole("button", { name: "Angre" }), {
      relatedTarget: outside,
    });
    act(() => {
      vi.advanceTimersByTime(6100);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
