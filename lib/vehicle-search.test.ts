import { describe, expect, it } from "vitest";
import { parseSearchPrompt, searchInventory } from "./vehicles";

describe("showroom search", () => {
  it("understands an Italian-language automatic SUV request", () => {
    const filters = parseSearchPrompt("SUV automatico sotto 25.000 €");
    const results = searchInventory(filters);

    expect(filters).toMatchObject({ maxPrice: 25000, body: "SUV", transmission: "Automatic" });
    expect(results.map((vehicle) => vehicle.id)).toEqual(["volvo-xc40", "cupra-formentor"]);
  });

  it("understands an English automatic SUV request with currency punctuation", () => {
    const filters = parseSearchPrompt("SUV, automatic, under €25,000");

    expect(filters).toMatchObject({ maxPrice: 25000, body: "SUV", transmission: "Automatic" });
  });

  it("supports a direct electric filter", () => {
    const results = searchInventory({ fuel: "Electric" });
    expect(results).toHaveLength(1);
    expect(results[0]?.model).toBe("Model 3");
  });

  it("does not drop a zero budget filter", () => {
    expect(searchInventory({ maxPrice: 0 })).toEqual([]);
  });
});
