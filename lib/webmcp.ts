import {
  getVehicle,
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
  status?: "rejected";
};

export const preferredDays = ["Tomorrow", "Saturday", "Next week"] as const;
export const preferredTimes = ["Morning", "Late afternoon", "Evening"] as const;

type Handlers = {
  onActivity: (activity: ToolActivity) => void;
  onSearch: (filters: SearchFilters) => { matches: Vehicle[]; summary: string };
  onCompare: (ids: string[]) => { vehicles: Vehicle[]; summary: string };
  onTradeIn: (input: { year: number; mileage: number }) => {
    range: string;
    note: string;
  };
  onDraftRequest: (input: { vehicleId: string; customerName?: string; preferredDay?: typeof preferredDays[number]; preferredTime?: typeof preferredTimes[number] }) => {
    vehicle: Vehicle | null;
    status: "draft_ready" | "vehicle_not_found";
    message: string;
  };
};

class InvalidToolInput extends Error {}

function asRecord(input: unknown, allowedKeys: readonly string[]): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new InvalidToolInput("Tool input must be an object.");
  }
  if (Object.keys(input).some((key) => !allowedKeys.includes(key))) {
    throw new InvalidToolInput("Tool input contains unsupported fields.");
  }
  return input as Record<string, unknown>;
}

function asString(value: unknown, key: string) {
  if (value !== undefined && typeof value !== "string") {
    throw new InvalidToolInput(`${key} must be a string.`);
  }
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown, key: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new InvalidToolInput(`${key} must be a finite, non-negative number.`);
  }
  return value;
}

function asOption<T extends string>(value: unknown, key: string, options: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  const option = options.find((candidate) => candidate === value);
  if (!option) throw new InvalidToolInput(`${key} must be one of: ${options.join(", ")}.`);
  return option;
}

function parseFilters(input: unknown): SearchFilters {
  const data = asRecord(input, ["query", "maxPrice", "fuel", "transmission", "body"]);

  return {
    query: asString(data.query, "query"),
    maxPrice: asNumber(data.maxPrice, "maxPrice"),
    fuel: asOption(data.fuel, "fuel", ["Hybrid", "Electric", "Petrol", "Diesel"]),
    transmission: asOption(data.transmission, "transmission", ["Automatic", "Manual"]),
    body: asOption(data.body, "body", ["SUV", "Hatchback", "Touring", "Crossover"]),
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
  const registration = new AbortController();
  const registrationSignal = AbortSignal.any([signal, registration.signal]);

  function execute<T>(name: string, options: ToolExecuteOptions, action: () => T) {
    registrationSignal.throwIfAborted();
    options.signal.throwIfAborted();
    try {
      return action();
    } catch (error) {
      if (!(error instanceof InvalidToolInput)) throw error;
      handlers.onActivity({ name, label: error.message, status: "rejected" });
      return { status: "invalid_input" as const, message: error.message };
    }
  }

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
          maxPrice: { type: "number", minimum: 0, description: "Maximum price in EUR. A zero budget returns no vehicles." },
          fuel: { type: "string", enum: ["Hybrid", "Electric", "Petrol", "Diesel"] },
          transmission: { type: "string", enum: ["Automatic", "Manual"] },
          body: { type: "string", enum: ["SUV", "Hatchback", "Touring", "Crossover"] },
        },
      },
      execute: async (input, options) => execute("search_inventory", options, () => {
        const filters = parseFilters(input);
        const result = handlers.onSearch(filters);
        handlers.onActivity({ name: "search_inventory", label: `Searched ${result.matches.length} vehicles` });
        return {
          summary: result.summary,
          matches: result.matches.map(vehicleSummary),
        };
      }),
    },
    {
      name: "compare_vehicles",
      title: "Compare vehicles",
      description: "Compare one to three distinct vehicles from this synthetic inventory on price, running profile, mileage and location. Unknown IDs are rejected.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["vehicleIds"],
        properties: {
          vehicleIds: { type: "array", minItems: 1, maxItems: 3, uniqueItems: true, items: { type: "string", minLength: 1 } },
        },
      },
      execute: async (input, options) => execute("compare_vehicles", options, () => {
        const data = asRecord(input, ["vehicleIds"]);
        const ids = data.vehicleIds;
        if (!Array.isArray(ids) || ids.length < 1 || ids.length > 3
          || !ids.every((id): id is string => typeof id === "string" && Boolean(getVehicle(id)))
          || new Set(ids).size !== ids.length) {
          throw new InvalidToolInput("vehicleIds must contain one to three distinct IDs from this inventory.");
        }
        const result = handlers.onCompare(ids);
        const selected = result.vehicles;
        handlers.onActivity({ name: "compare_vehicles", label: `Compared ${selected.length} vehicles` });
        return {
          summary: result.summary,
          vehicles: selected.map(vehicleSummary),
        };
      }),
    },
    {
      name: "evaluate_trade_in",
      title: "Simulate a demo trade-in range",
      description: "Simulate a fictional trade-in range using only year and mileage. This is a demo formula, not a vehicle valuation; no market, model or condition data is used.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["year", "mileage"],
        properties: {
          year: { type: "integer", minimum: 1900, maximum: new Date().getFullYear() },
          mileage: { type: "number", minimum: 0 },
        },
      },
      execute: async (input, options) => execute("evaluate_trade_in", options, () => {
        const data = asRecord(input, ["year", "mileage"]);
        const year = asNumber(data.year, "year");
        const mileage = asNumber(data.mileage, "mileage");
        if (year === undefined || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() || mileage === undefined) {
          throw new InvalidToolInput("Provide a year from 1900 to the current year and a non-negative mileage.");
        }
        const estimate = handlers.onTradeIn({ year, mileage });
        handlers.onActivity({ name: "evaluate_trade_in", label: "Prepared a fictional demo trade-in range" });
        return estimate;
      }),
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
          vehicleId: { type: "string", minLength: 1 },
          customerName: { type: "string" },
          preferredDay: { type: "string", enum: preferredDays },
          preferredTime: { type: "string", enum: preferredTimes },
        },
      },
      execute: async (input, options) => execute("draft_test_drive_request", options, () => {
        const data = asRecord(input, ["vehicleId", "customerName", "preferredDay", "preferredTime"]);
        const vehicleId = asString(data.vehicleId, "vehicleId");
        if (!vehicleId) throw new InvalidToolInput("vehicleId is required.");
        const result = handlers.onDraftRequest({
          vehicleId,
          customerName: asString(data.customerName, "customerName"),
          preferredDay: asOption(data.preferredDay, "preferredDay", preferredDays),
          preferredTime: asOption(data.preferredTime, "preferredTime", preferredTimes),
        });
        handlers.onActivity({ name: "draft_test_drive_request", label: result.message, ...(result.status === "vehicle_not_found" ? { status: "rejected" as const } : {}) });
        return result;
      }),
    },
  ];

  signal.throwIfAborted();
  try {
    await Promise.all(tools.map((tool) => context.registerTool(tool, { signal: registrationSignal })));
    registrationSignal.throwIfAborted();
  } catch (error) {
    // A failed registration must not leave a partially active tool set.
    registration.abort();
    throw error;
  }
  return true;
}

export function createTradeInEstimate(input: { year: number; mileage: number }) {
  const age = new Date().getFullYear() - input.year;
  const mileage = input.mileage;
  const base = Math.max(1500, 10500 - age * 850 - Math.round(mileage / 18000) * 450);
  const lower = Math.round(base / 500) * 500;
  return {
    range: `€${lower.toLocaleString("en-GB")}–€${(lower + 2500).toLocaleString("en-GB")}`,
    note: "Fictional demo simulation based only on year and mileage — not a vehicle valuation.",
  };
}

export function getDraftVehicle(vehicleId: string) {
  return getVehicle(vehicleId);
}
