import { expect, test } from "@playwright/test";

test("keeps the survey out of a form the app has put it in", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?viewMode=story&id=tester-inline-i-skjema--in-app-form",
  );

  await page.getByRole("textbox", { name: /Fritekst/ }).fill("Hei");
  await page.getByText("Bravo").click();
  await page.getByText("Xray").click();
  const combobox = page.getByRole("combobox", { name: /Søkbart flervalg/ });
  await combobox.fill("status");
  await combobox.press("ArrowDown");
  await combobox.press("Enter");

  await page.getByRole("button", { name: "Nullstill skjemaet" }).click();
  await expect(page.getByRole("textbox", { name: /Fritekst/ })).toHaveValue(
    "Hei",
  );
  await expect(page.getByRole("radio", { name: "Bravo" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Xray" })).toBeChecked();

  // The survey's search field is a text field too. In the app's form, it
  // would stop Enter from sending the form.
  const appField = page.getByRole("textbox", { name: "Appens felt" });
  await appField.fill("abc");
  await appField.press("Enter");
  await expect(page.locator("output")).toHaveText("Sendt med: felt");
});
