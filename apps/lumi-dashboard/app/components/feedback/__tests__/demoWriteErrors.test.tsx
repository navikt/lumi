import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteFeedbackDialog } from "~/components/feedback/DeleteFeedbackDialog";
import { TagEditor } from "~/components/feedback/TagEditor";
import {
  PUBLIC_DEMO_READ_ONLY_MESSAGE,
  PUBLIC_DEMO_READ_ONLY_TEXT,
} from "~/utils/publicDemo";

const tagHooks = vi.hoisted(() => {
  const idle = { mutate: vi.fn(), isError: false, error: null };
  return {
    add: { ...idle } as {
      mutate: () => void;
      isError: boolean;
      error: Error | null;
    },
    remove: { ...idle },
  };
});

vi.mock("~/hooks/useTags", () => ({
  useTags: () => ({ data: [] }),
  useAddTag: () => tagHooks.add,
  useRemoveTag: () => tagHooks.remove,
}));

beforeEach(() => {
  tagHooks.add.isError = false;
  tagHooks.add.error = null;
});

describe("TagEditor", () => {
  it("says the demo does not save tags when the demo refuses", () => {
    tagHooks.add.isError = true;
    tagHooks.add.error = new Error(PUBLIC_DEMO_READ_ONLY_MESSAGE);

    render(<TagEditor id="feedback-1" currentTags={["Bug"]} />);

    expect(screen.getByText(PUBLIC_DEMO_READ_ONLY_TEXT)).toBeInTheDocument();
  });

  it("asks for a retry when saving a tag fails for another reason", () => {
    tagHooks.add.isError = true;
    tagHooks.add.error = new Error("fetch failed");

    render(<TagEditor id="feedback-1" currentTags={[]} compact />);

    expect(
      screen.getByText("Taggen ble ikke lagret. Prøv igjen."),
    ).toBeInTheDocument();
  });

  it("shows no error while tags save normally", () => {
    render(<TagEditor id="feedback-1" currentTags={["Bug"]} />);

    expect(
      screen.queryByText(PUBLIC_DEMO_READ_ONLY_TEXT),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Taggen ble ikke lagret. Prøv igjen."),
    ).not.toBeInTheDocument();
  });
});

describe("DeleteFeedbackDialog", () => {
  it("shows why the answer was not deleted", () => {
    render(
      <DeleteFeedbackDialog
        id="feedback-1"
        onClose={() => {}}
        onConfirm={() => {}}
        isPending={false}
        errorText={PUBLIC_DEMO_READ_ONLY_TEXT}
      />,
    );

    expect(screen.getByText(PUBLIC_DEMO_READ_ONLY_TEXT)).toBeInTheDocument();
  });
});
