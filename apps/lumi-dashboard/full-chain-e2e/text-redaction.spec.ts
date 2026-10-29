import { expect, test } from "@playwright/test";

const demoUrl = process.env.LUMI_DEMO_URL ?? "http://127.0.0.1:3001";
const dashboardUrl = process.env.LUMI_DASHBOARD_URL ?? "http://127.0.0.1:3000";
const apiUrl = `http://127.0.0.1:${process.env.LUMI_API_HOST_PORT ?? "8080"}`;

test("selected text is permanently masked through the real dashboard, API and database", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(90000);
  for (const url of [demoUrl, dashboardUrl, apiUrl])
    expect(["localhost", "127.0.0.1"]).toContain(new URL(url).hostname);
  const marker = `mask-${Date.now()}`;
  const name = `Syntetisk Navn ${marker}`;
  const text = `God hjelp. 🙂 ${marker}. Hilsen ${name}`;
  await page.goto(demoUrl);
  await page
    .getByRole("combobox", { name: "Survey- og feltvariant" })
    .selectOption("rating-stars");
  const widget = page.getByRole("complementary", {
    name: "Tilbakemeldingspanel",
  });
  await widget.getByRole("radio", { name: "4 av 5 stjerner. Bra" }).click();
  await widget
    .getByRole("textbox", { name: "Legg gjerne til en begrunnelse" })
    .fill(text);
  const submitted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/azure/v1/feedback"),
  );
  await widget.getByRole("button", { name: "Send", exact: true }).click();
  expect((await submitted).status()).toBe(201);

  const url = `${dashboardUrl}/feedback?team=local-dev&surveyId=local-demo-rating-stars&query=${marker}`;
  const other = await context.newPage();
  for (const tab of [page, other]) {
    await tab.goto(url);
    await tab.getByRole("button", { name: "Utvid rad" }).click();
    await tab
      .getByRole("button", { name: "Masker tekst", exact: true })
      .click();
    const original = tab.getByRole("textbox", {
      name: "Marker teksten som skal fjernes",
    });
    await original.focus();
    await original.press("ControlOrMeta+A");
    await original.press("ArrowRight");
    for (let i = 0; i < name.length; i++)
      await original.press("Shift+ArrowLeft");
    await expect(
      tab.getByRole("region", { name: "Slik blir svaret" }),
    ).toContainText(text.replace(name, "[TEKST FJERNET]"));
  }
  await page
    .getByRole("button", { name: "Masker permanent", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("table")).toContainText("[TEKST FJERNET]");
  // The expanded answer survives the cache reset; reopening uses the new text.
  await page.getByRole("button", { name: "Masker tekst", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Marker teksten som skal fjernes" }),
  ).toHaveValue(text.replace(name, "[TEKST FJERNET]"));
  await page.getByRole("button", { name: "Avbryt", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("table")).not.toContainText(name);
  await expect(page.getByRole("table")).toContainText(marker);
  await page.getByRole("button", { name: "Utvid rad" }).click();
  await expect(page.getByRole("table")).toContainText("4/5");
  await other
    .getByRole("button", { name: "Masker permanent", exact: true })
    .click();
  await expect(other.getByRole("alert")).toContainText(
    "Svaret er endret siden du åpnet det",
  );
  await other.getByRole("button", { name: "Lukk og oppdater" }).click();
  await expect(other.getByRole("table")).toContainText("[TEKST FJERNET]");
  await expect(other.getByRole("table")).not.toContainText(name);
  await other.close();

  for (const format of ["json", "csv"]) {
    const response = await request.get(
      `${apiUrl}/api/v1/intern/export?team=local-dev&surveyId=local-demo-rating-stars&query=${marker}&format=${format}`,
      { headers: { Authorization: "Bearer local-full-chain" } },
    );
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain(marker);
    expect(body).toContain("[TEKST FJERNET]");
    expect(body).not.toContain(name);
  }
  await page.goto(
    `${dashboardUrl}/feedback?team=local-dev&surveyId=local-demo-rating-stars&query=${encodeURIComponent(name)}`,
  );
  await expect(
    page.getByText("Ingen treff med gjeldende filtre"),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
