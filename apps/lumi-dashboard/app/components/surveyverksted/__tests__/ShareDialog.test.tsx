import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShareDialog } from "~/components/surveyverksted/ShareDialog";

describe("ShareDialog save-error state", () => {
  it("names the save failure and offers a retry instead of an eternal spinner", async () => {
    const onRetrySave = vi.fn();
    render(
      <ShareDialog
        open
        onClose={() => {}}
        status="save-error"
        validationMessage={null}
        validationLocation={null}
        nextRevisionNumber={2}
        stats={{ pages: 1, questions: 2 }}
        revisions={[]}
        team="team-esyfo"
        freezing={false}
        freezeError={null}
        onFreeze={() => {}}
        onOpenSettings={() => {}}
        saveErrorMessage="Survey project not found"
        onRetrySave={onRetrySave}
      />,
    );

    expect(
      screen.getByText(/Utkastet får ikke lagret: Survey project not found/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Delingen fortsetter/)).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Prøv å lagre igjen" }),
    );
    expect(onRetrySave).toHaveBeenCalledTimes(1);
  });
});
