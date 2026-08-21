import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TextTheme } from "~/types/api";
import { ThemeModal } from ".";

const existingTheme: TextTheme = {
  id: "theme-1",
  team: "team-test",
  name: "Utbetaling",
  keywords: ["utbetaling"],
  color: "#3b82f6",
  priority: 0,
  analysisContext: "GENERAL_FEEDBACK",
};

describe("ThemeModal", () => {
  it("creates a theme with a selected keyword", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ThemeModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        availableWords={["søknad"]}
      />,
    );

    await user.type(screen.getByLabelText("Navn på temaet"), "Søknad");
    await user.click(screen.getByRole("combobox", { name: "Nøkkelord" }));
    await user.click(screen.getByRole("option", { name: "søknad" }));
    await user.click(screen.getByRole("button", { name: "Opprett tema" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Søknad",
      keywords: ["søknad"],
      color: "#3b82f6",
    });
  });

  it("connects validation errors to the fields", async () => {
    const user = userEvent.setup();
    render(
      <ThemeModal
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        availableWords={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Opprett tema" }));

    expect(screen.getByLabelText("Navn på temaet")).toBeInvalid();
    expect(screen.getByText("Skriv inn et navn på temaet")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Nøkkelord" })).toBeInvalid();
    expect(screen.getByText("Minst ett nøkkelord er påkrevd")).toBeVisible();
  });

  it("reserves Annet for responses without a configured theme", async () => {
    const user = userEvent.setup();
    render(
      <ThemeModal
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        availableWords={["søknad"]}
      />,
    );

    await user.type(screen.getByLabelText("Navn på temaet"), "ANNET");
    await user.click(screen.getByRole("combobox", { name: "Nøkkelord" }));
    await user.click(screen.getByRole("option", { name: "søknad" }));
    await user.click(screen.getByRole("button", { name: "Opprett tema" }));

    expect(
      screen.getByText(
        "Velg et annet navn. «Annet» brukes for svar uten tema.",
      ),
    ).toBeVisible();
  });

  it("connects a duplicate-name error to the name field and clears it on edit", async () => {
    const user = userEvent.setup();
    const onClearNameError = vi.fn();
    render(
      <ThemeModal
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        nameError="Det finnes allerede et tema med dette navnet. Velg et annet navn."
        onClearNameError={onClearNameError}
      />,
    );

    expect(screen.getByLabelText("Navn på temaet")).toBeInvalid();
    await user.type(screen.getByLabelText("Navn på temaet"), "Nytt navn");
    expect(onClearNameError).toHaveBeenCalled();
  });

  it("submits edits without losing existing keywords", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ThemeModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        theme={existingTheme}
      />,
    );

    const name = screen.getByLabelText("Navn på temaet");
    await user.clear(name);
    await user.type(name, "Utbetaling og vedtak");
    await user.click(screen.getByRole("button", { name: "Lagre endringer" }));

    expect(onSubmit).toHaveBeenCalledWith({
      themeId: "theme-1",
      name: "Utbetaling og vedtak",
      keywords: undefined,
      color: undefined,
    });
  });

  it("requires a second click before deleting", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <ThemeModal
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onDelete={onDelete}
        theme={existingTheme}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Slett tema" }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Bekreft sletting" }));
    expect(onDelete).toHaveBeenCalledWith("theme-1");
  });

  it("resets unsaved state when the modal is reopened", async () => {
    const user = userEvent.setup();
    const props = {
      onClose: vi.fn(),
      onSubmit: vi.fn(),
    };
    const { rerender } = render(<ThemeModal {...props} isOpen />);
    await user.type(screen.getByLabelText("Navn på temaet"), "Ikke lagret");

    rerender(<ThemeModal {...props} isOpen={false} />);
    rerender(<ThemeModal {...props} isOpen />);

    expect(screen.getByLabelText("Navn på temaet")).toHaveValue("");
  });

  it("shows mutation errors and communicates the selected color", () => {
    render(
      <ThemeModal
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        mutationError="Kunne ikke opprette temaet. Prøv igjen."
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Kunne ikke opprette temaet. Prøv igjen.",
    );
    expect(screen.getByRole("button", { name: "Blå" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not close with Escape while a mutation is pending", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ThemeModal isOpen isSubmitting onClose={onClose} onSubmit={vi.fn()} />,
    );

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("closes the Escape window before pending state has rendered", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ThemeModal
        isOpen
        onClose={onClose}
        onSubmit={vi.fn()}
        theme={existingTheme}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Lagre endringer" }));
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("submits only once on a fast double click", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ThemeModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        theme={existingTheme}
      />,
    );

    await user.dblClick(
      screen.getByRole("button", { name: "Lagre endringer" }),
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not cancel in the synchronous pending window", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ThemeModal
        isOpen
        onClose={onClose}
        onSubmit={vi.fn()}
        theme={existingTheme}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Lagre endringer" }));
    await user.click(screen.getByRole("button", { name: "Avbryt" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("allows retry after pending state and an error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      onSubmit,
      theme: existingTheme,
    };
    const { rerender } = render(<ThemeModal {...props} />);

    await user.click(screen.getByRole("button", { name: "Lagre endringer" }));
    rerender(<ThemeModal {...props} isSubmitting />);
    rerender(
      <ThemeModal {...props} mutationError="Kunne ikke lagre. Prøv igjen." />,
    );
    await user.click(screen.getByRole("button", { name: "Lagre endringer" }));

    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
