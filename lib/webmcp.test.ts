import { afterEach, describe, expect, it, vi } from "vitest";
import { vehicles, type SearchFilters, type Vehicle } from "./vehicles";
import { registerShowroomTools, type ToolActivity } from "./webmcp";

type CapturedTool = {
  name: string;
  execute: (input: unknown, options: { signal: AbortSignal }) => unknown | Promise<unknown>;
};

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

afterEach(() => {
  if (originalDocument) {
    Object.defineProperty(globalThis, "document", originalDocument);
  } else {
    delete (globalThis as Record<string, unknown>).document;
  }
});

describe("showroom WebMCP tools", () => {
  it("keeps native search and comparison calls synchronized with the visible state", async () => {
    const registeredTools: CapturedTool[] = [];
    const fakeDocument = {
      modelContext: {
        registerTool: async (tool: CapturedTool) => {
          registeredTools.push(tool);
        },
      },
    };
    Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });

    const activities: ToolActivity[] = [];
    const onSearch = vi.fn((filters: SearchFilters) => ({
      matches: [vehicles[0] as Vehicle],
      summary: `Searched with ${filters.maxPrice ?? "no"} max price.`,
    }));
    const onCompare = vi.fn((ids: string[]) => ({
      vehicles: [vehicles[1] as Vehicle],
      summary: `Compared ${ids.length} requested vehicles.`,
    }));

    const registered = await registerShowroomTools({
      onActivity: (activity) => activities.push(activity),
      onSearch,
      onCompare,
      onTradeIn: () => ({ range: "€5,000–€7,500", note: "Indicative only." }),
      onDraftRequest: () => ({
        vehicle: vehicles[0] as Vehicle,
        status: "draft_ready",
        message: "Draft ready.",
      }),
    }, new AbortController().signal);

    expect(registered).toBe(true);
    expect(registeredTools.map((tool) => tool.name)).toEqual([
      "search_inventory",
      "compare_vehicles",
      "evaluate_trade_in",
      "draft_test_drive_request",
    ]);

    const searchResult = await registeredTools[0]?.execute({ maxPrice: 25000 }, { signal: new AbortController().signal });
    const compareResult = await registeredTools[1]?.execute({ vehicleIds: ["volvo-xc40", "cupra-formentor"] }, { signal: new AbortController().signal });

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ maxPrice: 25000 }));
    expect(onCompare).toHaveBeenCalledWith(["volvo-xc40", "cupra-formentor"]);
    expect(searchResult).toMatchObject({ matches: [{ id: "volvo-xc40" }] });
    expect(compareResult).toMatchObject({ vehicles: [{ id: "cupra-formentor" }] });
    expect(activities.map((activity) => activity.name)).toEqual(["search_inventory", "compare_vehicles"]);
  });
});
