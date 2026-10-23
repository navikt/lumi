import { describe, expect, it } from "vitest";
import { searchSchema } from "../searchSchema";

describe("searchSchema", () => {
  it("drops unknown enum values instead of failing", () => {
    const search = searchSchema.parse({
      dateMode: "foo",
      compare: "sometimes",
      periodPreset: "forever",
      trendInterval: "x",
      trendMeasure: "y",
    });

    expect(search.dateMode).toBeUndefined();
    expect(search.compare).toBeUndefined();
    expect(search.periodPreset).toBeUndefined();
    expect(search.trendInterval).toBeUndefined();
    expect(search.trendMeasure).toBeUndefined();
  });

  it("drops values that are not strings", () => {
    const search = searchSchema.parse({ team: 5, page: ["1"], query: true });

    expect(search.team).toBeUndefined();
    expect(search.page).toBeUndefined();
    expect(search.query).toBeUndefined();
  });

  it("keeps valid values", () => {
    expect(
      searchSchema.parse({
        team: "flex",
        dateMode: "auto",
        compare: "previous",
        trendInterval: "week",
      }),
    ).toMatchObject({
      team: "flex",
      dateMode: "auto",
      compare: "previous",
      trendInterval: "week",
    });
  });

  it("maps legacy choice and rating params, and the new params win", () => {
    expect(
      searchSchema.parse({
        choiceFieldId: "field-1",
        choiceValue: "a",
        ratingFieldId: "rating-1",
        ratingValue: "5",
      }),
    ).toMatchObject({ choice: "field-1:a", rating: "rating-1:5" });

    expect(
      searchSchema.parse({
        choice: "field-2:b",
        choiceFieldId: "field-1",
        choiceValue: "a",
      }).choice,
    ).toBe("field-2:b");
  });
});
