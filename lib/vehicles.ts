export type FuelType = "Hybrid" | "Electric" | "Petrol" | "Diesel";
export type Transmission = "Automatic" | "Manual";
export type BodyStyle = "SUV" | "Hatchback" | "Touring" | "Crossover";

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  trim: string;
  year: number;
  price: number;
  mileage: number;
  fuel: FuelType;
  transmission: Transmission;
  body: BodyStyle;
  location: string;
  color: string;
  range?: number;
  tagline: string;
  fitNote: string;
  art: "ember" | "moss" | "cobalt" | "rose" | "sand";
};

export const vehicles: Vehicle[] = [
  {
    id: "volvo-xc40",
    brand: "Volvo",
    model: "XC40",
    trim: "B3 Plus Dark",
    year: 2023,
    price: 23900,
    mileage: 18400,
    fuel: "Hybrid",
    transmission: "Automatic",
    body: "SUV",
    location: "Bologna",
    color: "Sage green",
    tagline: "Quiet confidence, city-sized.",
    fitNote: "The balanced pick: compact, automatic and comfortable for every day.",
    art: "moss",
  },
  {
    id: "cupra-formentor",
    brand: "CUPRA",
    model: "Formentor",
    trim: "1.5 TSI VZ",
    year: 2022,
    price: 24900,
    mileage: 27100,
    fuel: "Petrol",
    transmission: "Automatic",
    body: "Crossover",
    location: "Modena",
    color: "Graphite",
    tagline: "A little more edge in the everyday.",
    fitNote: "The expressive pick: athletic proportions with effortless automatic driving.",
    art: "cobalt",
  },
  {
    id: "toyota-yaris-cross",
    brand: "Toyota",
    model: "Yaris Cross",
    trim: "1.5 Lounge",
    year: 2024,
    price: 25700,
    mileage: 8900,
    fuel: "Hybrid",
    transmission: "Automatic",
    body: "Crossover",
    location: "Ferrara",
    color: "Pearl white",
    tagline: "Small footprint. Big peace of mind.",
    fitNote: "The newest pick: low mileage, efficient hybrid power and easy parking.",
    art: "sand",
  },
  {
    id: "tesla-model-3",
    brand: "Tesla",
    model: "Model 3",
    trim: "Long Range AWD",
    year: 2021,
    price: 26800,
    mileage: 41600,
    fuel: "Electric",
    transmission: "Automatic",
    body: "Touring",
    location: "Parma",
    color: "Midnight blue",
    range: 602,
    tagline: "The long way home, made simple.",
    fitNote: "The electric option: long range, instant response and a calm cabin.",
    art: "cobalt",
  },
  {
    id: "mazda-3",
    brand: "Mazda",
    model: "3",
    trim: "Skyactiv-G Exclusive",
    year: 2023,
    price: 21900,
    mileage: 22100,
    fuel: "Petrol",
    transmission: "Manual",
    body: "Hatchback",
    location: "Reggio Emilia",
    color: "Soul red",
    tagline: "Thoughtful design, proper steering.",
    fitNote: "The driver’s pick: beautifully finished and below the budget line.",
    art: "rose",
  },
  {
    id: "bmw-118d",
    brand: "BMW",
    model: "118d",
    trim: "M Sport",
    year: 2022,
    price: 22800,
    mileage: 33800,
    fuel: "Diesel",
    transmission: "Automatic",
    body: "Hatchback",
    location: "Imola",
    color: "Mineral grey",
    tagline: "A familiar shape with a sharper pulse.",
    fitNote: "The long-distance pick: efficient diesel touring with a premium feel.",
    art: "ember",
  },
];

export type SearchFilters = {
  query?: string;
  maxPrice?: number;
  fuel?: FuelType;
  transmission?: Transmission;
  body?: BodyStyle;
};

export function getVehicle(id: string) {
  return vehicles.find((vehicle) => vehicle.id === id) ?? null;
}

export function searchInventory(filters: SearchFilters = {}) {
  const normalizedQuery = filters.query?.trim().toLowerCase();

  return vehicles.filter((vehicle) => {
    const searchable = [vehicle.brand, vehicle.model, vehicle.trim, vehicle.body, vehicle.fuel].join(" ").toLowerCase();
    const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
    const matchesPrice = !filters.maxPrice || vehicle.price <= filters.maxPrice;
    const matchesFuel = !filters.fuel || vehicle.fuel === filters.fuel;
    const matchesTransmission = !filters.transmission || vehicle.transmission === filters.transmission;
    const matchesBody = !filters.body
      || vehicle.body === filters.body
      || (filters.body === "SUV" && vehicle.body === "Crossover");
    return matchesQuery && matchesPrice && matchesFuel && matchesTransmission && matchesBody;
  });
}

export function parseSearchPrompt(prompt: string): SearchFilters {
  const normalized = prompt.toLowerCase();
  const priceMatch = normalized.match(/(?:sotto|meno di|under|below)\s*€?\s*([\d.,]+)/i);
  const maxPrice = priceMatch ? Number(priceMatch[1].replace(/[.,]/g, "")) : undefined;

  const fuel = normalized.includes("elettric") || normalized.includes("electric")
    ? "Electric"
    : normalized.includes("diesel")
      ? "Diesel"
      : normalized.includes("ibrid") || normalized.includes("hybrid")
        ? "Hybrid"
        : normalized.includes("benzina") || normalized.includes("petrol")
          ? "Petrol"
          : undefined;

  const body = normalized.includes("suv")
    ? "SUV"
    : normalized.includes("crossover")
      ? "Crossover"
      : normalized.includes("hatchback")
        ? "Hatchback"
        : normalized.includes("touring") || normalized.includes("berlina")
          ? "Touring"
          : undefined;

  return {
    maxPrice,
    fuel,
    body,
    transmission: normalized.includes("automatic") || normalized.includes("automatico") ? "Automatic" : undefined,
  };
}

export function compareVehicles(ids: string[]) {
  return ids.map(getVehicle).filter((vehicle): vehicle is Vehicle => Boolean(vehicle)).slice(0, 3);
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMileage(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}
