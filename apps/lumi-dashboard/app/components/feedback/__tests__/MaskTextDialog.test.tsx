import { webcrypto } from "node:crypto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorException, ErrorType } from "~/types/errors";
import { textRedactionHash } from "~/utils/textRedaction";
import { MaskTextDialog } from "../MaskTextDialog";

const request = vi.hoisted(() => vi.fn());
vi.mock("~/server/actions/redactFeedback", () => ({
  redactFeedbackServerFn: request,
}));
const target = {
  id: "feedback-1",
  team: "team-test",
  fieldId: "comment",
  question: "Hva fungerte?",
  text: "God hjelp.\r\nHilsen 🙂 Ola Nordmann",
};
beforeEach(() => {
  request.mockReset().mockResolvedValue({ success: true });
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["feedback", "inactive"], { text: target.text });
  const callbacks = {
    onClose: vi.fn(),
    onMasked: vi.fn(),
    onRefreshed: vi.fn(),
  };
  render(
    <QueryClientProvider client={client}>
      <MaskTextDialog target={target} {...callbacks} />
    </QueryClientProvider>,
  );
  return { client, ...callbacks, user: userEvent.setup() };
}
async function selectName(user: ReturnType<typeof userEvent.setup>) {
  const textarea = screen.getByRole("textbox", {
    name: "Marker teksten som skal fjernes",
  }) as HTMLTextAreaElement;
  await user.click(textarea);
  const start = textarea.value.indexOf("Ola Nordmann");
  textarea.setSelectionRange(start, start + "Ola Nordmann".length);
  fireEvent.select(textarea);
  await user.click(screen.getByRole("button", { name: "Legg til markering" }));
}
describe("permanent text masking dialog", () => {
  it("lets keyboard users extend a selection across a whole emoji without editing text", async () => {
    setup();
    const textarea = screen.getByRole("textbox", {
      name: "Marker teksten som skal fjernes",
    }) as HTMLTextAreaElement;
    const emojiEnd = textarea.value.indexOf("🙂") + 2;
    textarea.setSelectionRange(emojiEnd, emojiEnd);
    fireEvent.keyDown(textarea, { key: "ArrowLeft", shiftKey: true });
    expect(
      textarea.value.slice(textarea.selectionStart, textarea.selectionEnd),
    ).toBe("🙂");
    fireEvent.click(screen.getByRole("button", { name: "Legg til markering" }));
    expect(
      screen.getByRole("textbox", { name: "Slik blir svaret" }),
    ).toHaveValue("God hjelp.\nHilsen [TEKST FJERNET] Ola Nordmann");
    expect(request).not.toHaveBeenCalled();
  });
  it("previews only the selection, keeps the original read-only and does not save on cancel", async () => {
    const { user, onClose } = setup();
    expect(
      screen.getByRole("button", { name: "Masker permanent" }),
    ).toBeDisabled();
    await selectName(user);
    expect(
      screen.getByRole("textbox", { name: "Slik blir svaret" }),
    ).toHaveValue("God hjelp.\nHilsen 🙂 [TEKST FJERNET]");
    expect(
      screen.getByRole("textbox", { name: "Marker teksten som skal fjernes" }),
    ).toHaveAttribute("readonly");
    expect(request).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("sends original offsets and fingerprint only, then clears cached text before success", async () => {
    const { user, client, onMasked } = setup();
    await selectName(user);
    await user.click(screen.getByRole("button", { name: "Masker permanent" }));
    await waitFor(() => expect(onMasked).toHaveBeenCalledOnce());
    expect(request).toHaveBeenCalledExactlyOnceWith({
      data: {
        id: target.id,
        team: target.team,
        fieldId: target.fieldId,
        expectedTextHash: await textRedactionHash(target.text),
        ranges: [
          {
            start: target.text.indexOf("Ola Nordmann"),
            end: target.text.length,
          },
        ],
      },
    });
    expect(client.getQueryData(["feedback", "inactive"])).toBeUndefined();
  });
  it("requires fresh data after a conflict and never retries stale offsets", async () => {
    request.mockRejectedValue(
      new ApiErrorException({
        status: 409,
        type: ErrorType.CONFLICT,
        message: "Endret",
        timestamp: "2026-10-28T12:00:00Z",
      }),
    );
    const { user, onRefreshed, onMasked, client } = setup();
    await selectName(user);
    await user.click(screen.getByRole("button", { name: "Masker permanent" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Svaret er endret siden du åpnet det",
    );
    expect(
      screen.queryByRole("button", { name: "Masker permanent" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lukk og oppdater" }));
    expect(onRefreshed).toHaveBeenCalledOnce();
    expect(onMasked).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledOnce();
    expect(client.getQueryData(["feedback", "inactive"])).toBeUndefined();
  });
  it("prevents a duplicate submission and closing while a write is in progress", async () => {
    let finish: (value: { success: boolean }) => void = () => {};
    request.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { user, onClose, onMasked } = setup();
    await selectName(user);
    await user.click(screen.getByRole("button", { name: "Masker permanent" }));
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Avbryt" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Masker permanent/ }),
    ).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    finish({ success: true });
    await waitFor(() => expect(onMasked).toHaveBeenCalledOnce());
  });
});
