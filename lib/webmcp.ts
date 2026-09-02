import {
  compareVehicles,
  getVehicle,
  searchInventory,
  type SearchFilters,
  type Vehicle,
} from "./vehicles";

type ToolExecuteOptions = { signal: AbortSignal };

type ModelContextTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, options: ToolExecuteOptions) => unknown | Promise<unknown>;
};

type ModelContext = {
  registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => Promise<void>;
};

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

export type ToolActivity = {
  name: string;
  label: string;
};

type Handlers = {
  onActivity: (activity: ToolActivity) => void;
  onSearch: (filters: SearchFilters) => { matches: Vehicle[]; summary: string };
  onCompare: (ids: string[]) => { vehicles: Vehicle[]; summary: string };
  onTradeIn: (input: { make?: string; model?: string; year?: number; mileage?: number }) => {
    range: string;
    note: string;
  };
  onDraftRequest: (input: { vehicleId: string; customerName?: string; preferredDay?: string; preferredTime?: string }) => {
    vehicle: Vehicle | null;
    status: "draft_ready" | "vehicle_not_found";
    message: string;
  };
};

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseFilters(input: unknown): SearchFilters {
  const data = asRecord(input);
  const fuel = asString(data.fuel);
  const transmission = asString(data.transmission);
  const body = asString(data.body);

  return {
    query: asString(data.query),
    maxPrice: asNumber(data.maxPrice),
    fuel: fuel === "Hybrid" || fuel === "Electric" || fuel === "Petrol" || fuel === "Diesel" ? fuel : undefined,
    transmission: transmission === "Automatic" || transmission === "Manual" ? transmission : undefined,
    body: body === "SUV" || body === "Hatchback" || body === "Touring" || body === "Crossover" ? body : undefined,
  };
}

function vehicleSummary(vehicle: Vehicle) {
  return {
    id: vehicle.id,
    name: `${vehicle.brand} ${vehicle.model} ${vehicle.trim}`,
    price: vehicle.price,
    year: vehicle.year,
    mileage: vehicle.mileage,
    fuel: vehicle.fuel,
    transmission: vehicle.transmission,
    location: vehicle.location,
  };
}

export async function registerShowroomTools(handlers: Handlers, signal: AbortSignal) {
  const context = document.modelContext;
  if (!context) return false;

  const tools: ModelContextTool[] = [
    {
      name: "search_inventory",
      title: "Search dealer inventory",
      description: "Find available vehicles by budget, body style, fuel type and transmission. Return concise structured results.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", description: "Optional make, model or keyword." },
          maxPrice: { type: "number", description: "Maximum price in EUR." },
          fuel: { type: "string", enum: ["Hybrid", "Electric", "Petrol", "Diesel"] },
          transmission: { type: "string", enum: ["Automatic", "Manual"] },
          body: { type: "string", enum: ["SUV", "Hatchback", "Touring", "Crossover"] },
        },
      },
      execute: async (input) => {
        const filters = parseFilters(input);
        const matches = searchInventory(filters);
        handlers.onActivity({ name: "search_inventory", label: `Searched ${matches.length} vehicles` });
        return {
          summary: matches.length ? `${matches.length} vehicles match the current brief.` : "No vehicles match. Relax one filter and try again.",
          matches: matches.map(vehicleSummary),
        };
      },
    },
    {
      name: "compare_vehicles",
      title: "Compare vehicles",
      description: "Compare up to three vehicles from the current showroom shortlist on price, running profile, mileage and location.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["vehicleIds"],
        properties: {
          vehicleIds: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
        },
      },
      execute: async (input) => {
        const data = asRecord(input);
        const ids = Array.isArray(data.vehicleIds) ? data.vehicleIds.filter((id): id is string => typeof id === "string") : [];
        const selected = compareVehicles(ids);
        handlers.onActivity({ name: "compare_vehicles", label: `Compared ${selected.length} vehicles` });
        return {
          summary: selected.length ? `Comparison ready for ${selected.length} vehicles.` : "Select at least one vehicle from the current inventory.",
          vehicles: selected.map(vehicleSummary),
        };
      },
    },
    {
      name: "evaluate_trade_in",
      title: "Prepare a trade-in estimate",
      description: "Create a clearly labelled indicative trade-in range from a customer's vehicle details. This never commits a valuation.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          make: { type: "string" },
          model: { type: "string" },
          year: { type: "number" },
          mileage: { type: "number" },
        },
      },
      execute: async (input) => {
        const data = asRecord(input);
        const estimate = handlers.onTradeIn({
          make: asString(data.make),
          model: asString(data.model),
          year: asNumber(data.year),
          mileage: asNumber(data.mileage),
        });
        handlers.onActivity({ name: "evaluate_trade_in", label: "Prepared an indicative trade-in range" });
        return estimate;
      },
    },
    {
      name: "draft_test_drive_request",
      title: "Draft a test-drive request",
      description: "Prepare a test-drive request for human review. Never send a message, book an appointment or create a real lead.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["vehicleId"],
        properties: {
          vehicleId: { type: "string" },
          customerName: { type: "string" },
          preferredDay: { type: "string" },
          preferredTime: { type: "string" },
        },
      },
      execute: async (input) => {
        const data = asRecord(input);
        const result = handlers.onDraftRequest({
          vehicleId: asString(data.vehicleId) ?? "",
          customerName: asString(data.customerName),
          preferredDay: asString(data.preferredDay),
          preferredTime: asString(data.preferredTime),
        });
        handlers.onActivity({ name: "draft_test_drive_request", label: result.message });
        return result;
      },
    },
  ];

  await Promise.all(tools.map((tool) => context.registerTool(tool, { signal })));
  return true;
}

export function createTradeInEstimate(input: { year?: number; mileage?: number }) {
  const age = input.year ? Math.max(0, new Date().getFullYear() - input.year) : 6;
  const mileage = input.mileage ?? 70000;
  const base = Math.max(1500, 10500 - age * 850 - Math.round(mileage / 18000) * 450);
  const lower = Math.round(base / 500) * 500;
  return {
    range: `€${lower.toLocaleString("en-GB")}–€${(lower + 2500).toLocaleString("en-GB")}`,
    note: "Indicative only — a dealer reviews condition and documents before confirming a value.",
  };
}

export function getDraftVehicle(vehicleId: string) {
  return getVehicle(vehicleId);
}
