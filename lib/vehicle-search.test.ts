import { describe, expect, it } from "vitest";
import { parseSearchPrompt, searchInventory } from "./vehicles";

describe("showroom search", () => {
  it("understands an Italian automatic SUV request", () => {
    const filters = parseSearchPrompt("SUV automatico sotto 25.000 €");
    const results = searchInventory(filters);

    expect(filters).toMatchObject({ maxPrice: 25000, body: "SUV", transmission: "Automatic" });
    expect(results.map((vehicle) => vehicle.id)).toEqual(["volvo-xc40", "cupra-formentor"]);
  });

  it("supports a direct electric filter", () => {
    const results = searchInventory({ fuel: "Electric" });
    expect(results).toHaveLength(1);
    expect(results[0]?.model).toBe("Model 3");
  });
});
