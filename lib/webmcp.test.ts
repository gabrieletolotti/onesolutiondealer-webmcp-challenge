import { afterEach, describe, expect, it, vi } from "vitest";
import { compareVehicles, searchInventory } from "./vehicles";
import { createTradeInEstimate, getDraftVehicle, registerShowroomTools, type ToolActivity } from "./webmcp";

type Context = NonNullable<Document["modelContext"]>;
type Tool = Parameters<Context["registerTool"]>[0];
type Handlers = Parameters<typeof registerShowroomTools>[0];
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

afterEach(() => {
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

async function setup() {
  const tools: Tool[] = [];
  const registrations: AbortSignal[] = [];
  const activities: ToolActivity[] = [];
  let draft: Parameters<Handlers["onDraftRequest"]>[0] | undefined;
  const handlers: Handlers = {
    onActivity: (activity) => activities.push(activity),
    onSearch: vi.fn<Handlers["onSearch"]>((filters) => {
      const matches = searchInventory(filters);
      return { matches, summary: matches.length ? `${matches.length} vehicles match.` : "No vehicles match." };
    }),
    onCompare: vi.fn<Handlers["onCompare"]>((ids) => ({ vehicles: compareVehicles(ids), summary: "Comparison ready." })),
    onTradeIn: vi.fn(createTradeInEstimate),
    onDraftRequest: vi.fn<Handlers["onDraftRequest"]>((input) => {
      const vehicle = getDraftVehicle(input.vehicleId);
      if (!vehicle) return { vehicle: null, status: "vehicle_not_found", message: "Vehicle not found." };
      draft = input;
      return { vehicle, status: "draft_ready", message: "Draft ready." };
    }),
  };
  const context: Context = {
    registerTool: async (tool, options) => {
      tools.push(tool);
      if (options?.signal) registrations.push(options.signal);
    },
  };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { modelContext: context } });
  const controller = new AbortController();
  expect(await registerShowroomTools(handlers, controller.signal)).toBe(true);
  const tool = (name: string) => {
    const found = tools.find((entry) => entry.name === name);
    if (!found) throw new Error(`Missing tool: ${name}`);
    return found;
  };
  const call = (name: string, input: unknown) => tool(name).execute(input, { signal: new AbortController().signal });
  return { tools, registrations, activities, handlers, controller, tool, call, getDraft: () => draft };
}

describe("showroom WebMCP tools", () => {
  it("runs the complete synthetic search, comparison, simulation and draft flow", async () => {
    const { tools, call, getDraft, activities } = await setup();
    expect(tools.map((tool) => tool.name)).toEqual(["search_inventory", "compare_vehicles", "evaluate_trade_in", "draft_test_drive_request"]);
    expect(await call("search_inventory", { body: "SUV", transmission: "Automatic", maxPrice: 25000 }))
      .toMatchObject({ matches: [{ id: "volvo-xc40" }, { id: "cupra-formentor" }] });
    expect(await call("compare_vehicles", { vehicleIds: ["cupra-formentor", "volvo-xc40"] }))
      .toMatchObject({ vehicles: [{ id: "cupra-formentor" }, { id: "volvo-xc40" }] });
    expect(await call("evaluate_trade_in", { year: 2019, mileage: 70000 }))
      .toMatchObject({ range: expect.stringMatching(/^€/), note: expect.stringContaining("not a vehicle valuation") });
    expect(await call("draft_test_drive_request", { vehicleId: "volvo-xc40", preferredDay: "Saturday", preferredTime: "Evening" }))
      .toMatchObject({ status: "draft_ready", vehicle: { id: "volvo-xc40" } });
    expect(getDraft()).toMatchObject({ preferredDay: "Saturday", preferredTime: "Evening" });
    expect(activities.map((activity) => activity.name)).toEqual(tools.map((tool) => tool.name));
  });

  it("returns no matches for a valid zero budget", async () => {
    const { call } = await setup();
    expect(await call("search_inventory", { maxPrice: 0 })).toMatchObject({ matches: [], summary: "No vehicles match." });
  });

  it.each([null, [], { maxPrice: "25000" }, { maxPrice: -1 }, { maxPrice: NaN }, { maxPrice: Infinity }, { fuel: "Unknown" }, { transmission: "Unknown" }, { body: "Unknown" }, { query: 123 }, { unsupported: true }])
    ("rejects invalid search input without broadening the search: %j", async (input) => {
      const { call, handlers, activities } = await setup();
      expect(await call("search_inventory", input)).toMatchObject({ status: "invalid_input" });
      expect(handlers.onSearch).not.toHaveBeenCalled();
      expect(activities.at(-1)).toMatchObject({ status: "rejected" });
    });

  it.each([{}, { vehicleIds: [] }, { vehicleIds: ["unknown"] }, { vehicleIds: [123] }, { vehicleIds: ["volvo-xc40", "volvo-xc40"] }, { vehicleIds: ["volvo-xc40", "cupra-formentor", "mazda-3", "bmw-118d"] }])
    ("rejects invalid comparisons without changing selection: %j", async (input) => {
      const { call, handlers } = await setup();
      expect(await call("compare_vehicles", input)).toMatchObject({ status: "invalid_input" });
      expect(handlers.onCompare).not.toHaveBeenCalled();
    });

  it.each([{}, { year: 2019 }, { year: 2099, mileage: 70000 }, { year: 1899, mileage: 0 }, { year: 2019.5, mileage: 0 }, { year: 2019, mileage: -1 }, { year: 2019, mileage: Infinity }, { year: "2019", mileage: 70000 }, { year: 2019, mileage: 70000, make: "Volkswagen" }])
    ("rejects invalid or unsupported simulation inputs: %j", async (input) => {
      const { call, handlers } = await setup();
      expect(await call("evaluate_trade_in", input)).toMatchObject({ status: "invalid_input" });
      expect(handlers.onTradeIn).not.toHaveBeenCalled();
    });

  it.each([{}, { vehicleId: " " }, { vehicleId: 123 }, { vehicleId: "volvo-xc40", preferredDay: "Never" }, { vehicleId: "volvo-xc40", preferredTime: "Midnight" }, { vehicleId: "volvo-xc40", customerName: 123 }])
    ("rejects invalid draft fields before opening a draft: %j", async (input) => {
      const { call, handlers } = await setup();
      expect(await call("draft_test_drive_request", input)).toMatchObject({ status: "invalid_input" });
      expect(handlers.onDraftRequest).not.toHaveBeenCalled();
    });

  it("preserves a valid draft when a subsequent vehicle is not found", async () => {
    const { call, getDraft, activities } = await setup();
    await call("draft_test_drive_request", { vehicleId: "volvo-xc40" });
    expect(await call("draft_test_drive_request", { vehicleId: "unknown" })).toMatchObject({ status: "vehicle_not_found", vehicle: null });
    expect(getDraft()?.vehicleId).toBe("volvo-xc40");
    expect(activities.at(-1)).toMatchObject({ status: "rejected" });
  });

  it("keeps the normal showroom available without the browser API", async () => {
    const { handlers } = await setup();
    Object.defineProperty(globalThis, "document", { configurable: true, value: {} });
    expect(await registerShowroomTools(handlers, new AbortController().signal)).toBe(false);
    expect(handlers.onSearch).not.toHaveBeenCalled();
  });

  it("aborts every registration if any tool registration fails", async () => {
    const { handlers } = await setup();
    const signals: AbortSignal[] = [];
    const context: Context = {
      registerTool: async (tool, options) => {
        if (options?.signal) signals.push(options.signal);
        if (tool.name === "compare_vehicles") throw new Error("Registration failed");
      },
    };
    Object.defineProperty(globalThis, "document", { configurable: true, value: { modelContext: context } });
    await expect(registerShowroomTools(handlers, new AbortController().signal)).rejects.toThrow("Registration failed");
    expect(signals).toHaveLength(4);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("unregisters and prevents retained executors from running after unmount", async () => {
    const { controller, registrations, call, handlers } = await setup();
    controller.abort();
    expect(registrations.every((signal) => signal.aborted)).toBe(true);
    await expect(call("search_inventory", {})).rejects.toMatchObject({ name: "AbortError" });
    expect(handlers.onSearch).not.toHaveBeenCalled();
  });

  it("honors client cancellation before updating the page", async () => {
    const { tool, handlers } = await setup();
    const controller = new AbortController();
    controller.abort();
    await expect(tool("search_inventory").execute({}, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(handlers.onSearch).not.toHaveBeenCalled();
  });

  it("does not disguise an unexpected handler error as invalid user input", async () => {
    const { call, handlers } = await setup();
    vi.mocked(handlers.onSearch).mockImplementation(() => { throw new Error("Unexpected failure"); });
    await expect(call("search_inventory", {})).rejects.toThrow("Unexpected failure");
  });
});
