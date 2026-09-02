"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  compareVehicles,
  formatMileage,
  formatPrice,
  parseSearchPrompt,
  searchInventory,
  vehicles,
  type SearchFilters,
  type Vehicle,
} from "@/lib/vehicles";
import {
  createTradeInEstimate,
  getDraftVehicle,
  registerShowroomTools,
  type ToolActivity,
} from "@/lib/webmcp";

type Draft = {
  vehicle: Vehicle;
  customerName: string;
  preferredDay: string;
  preferredTime: string;
  saved: boolean;
};

type Activity = ToolActivity & { id: number };

function vehicleName(vehicle: Vehicle) {
  return `${vehicle.brand} ${vehicle.model}`;
}

function toolLabel(name: string) {
  return name.replaceAll("_", " ");
}

function VehicleArt({ vehicle, compact = false }: { vehicle: Vehicle; compact?: boolean }) {
  return (
    <div className={`vehicle-art art-${vehicle.art} ${compact ? "vehicle-art-compact" : ""}`} aria-hidden="true">
      <span className="art-stamp">{vehicle.year}</span>
      <div className="art-sun" />
      <div className="art-car">
        <span className="art-roof" />
        <span className="art-window art-window-left" />
        <span className="art-window art-window-right" />
        <span className="art-wheel art-wheel-left" />
        <span className="art-wheel art-wheel-right" />
      </div>
      <span className="art-brand">{vehicle.brand}</span>
    </div>
  );
}

function VehicleCard({
  vehicle,
  selected,
  onToggleCompare,
  onDraft,
  onFocus,
}: {
  vehicle: Vehicle;
  selected: boolean;
  onToggleCompare: () => void;
  onDraft: () => void;
  onFocus: () => void;
}) {
  return (
    <article className={`vehicle-card ${selected ? "vehicle-card-selected" : ""}`}>
      <button className="vehicle-art-button" onClick={onFocus} aria-label={`View ${vehicleName(vehicle)} details`}>
        <VehicleArt vehicle={vehicle} />
      </button>
      <div className="vehicle-card-body">
        <div className="vehicle-card-heading">
          <div>
            <p className="eyebrow eyebrow-small">{vehicle.brand}</p>
            <h3>{vehicle.model}</h3>
          </div>
          <strong>{formatPrice(vehicle.price)}</strong>
        </div>
        <p className="vehicle-trim">{vehicle.trim}</p>
        <div className="vehicle-specs">
          <span>{vehicle.year}</span>
          <span>{formatMileage(vehicle.mileage)} km</span>
          <span>{vehicle.fuel}</span>
          <span>{vehicle.transmission}</span>
        </div>
        <p className="vehicle-fit">{vehicle.fitNote}</p>
        <div className="card-actions">
          <button className={`compare-button ${selected ? "compare-button-active" : ""}`} onClick={onToggleCompare}>
            <span className="button-check">{selected ? "✓" : "+"}</span>
            {selected ? "In comparison" : "Compare"}
          </button>
          <button className="text-button" onClick={onDraft}>Prepare a drive <span>↗</span></button>
        </div>
      </div>
    </article>
  );
}

export default function Showroom() {
  const [query, setQuery] = useState("Cerco un SUV automatico sotto 25.000 €");
  const [matches, setMatches] = useState<Vehicle[]>(() => searchInventory(parseSearchPrompt("SUV automatico sotto 25.000 €")));
  const [selectedIds, setSelectedIds] = useState<string[]>(["volvo-xc40", "cupra-formentor"]);
  const [focusedVehicle, setFocusedVehicle] = useState<Vehicle>(vehicles[0]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tradeIn, setTradeIn] = useState<{ range: string; note: string } | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [webMcpStatus, setWebMcpStatus] = useState<"detecting" | "ready" | "browser" | "error">("detecting");
  const [showAll, setShowAll] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);
  const activityId = useRef(0);

  const addActivity = (item: ToolActivity) => {
    activityId.current += 1;
    setActivity((current) => [{ ...item, id: activityId.current }, ...current].slice(0, 4));
  };

  const runSearch = (filters: SearchFilters, label = "Searched the showroom") => {
    const result = searchInventory(filters);
    setMatches(result);
    setSelectedIds(result.slice(0, 2).map((vehicle) => vehicle.id));
    if (result[0]) setFocusedVehicle(result[0]);
    addActivity({ name: "search_inventory", label: `${label} · ${result.length} match${result.length === 1 ? "" : "es"}` });
    workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onManualSearch = () => {
    runSearch(parseSearchPrompt(query), "Searched the showroom");
  };

  const toggleCompare = (vehicleId: string) => {
    setSelectedIds((current) => current.includes(vehicleId)
      ? current.filter((id) => id !== vehicleId)
      : current.length < 3 ? [...current, vehicleId] : current);
  };

  const openDraft = (vehicle: Vehicle) => {
    setDraft({ vehicle, customerName: "", preferredDay: "Tomorrow", preferredTime: "Late afternoon", saved: false });
    addActivity({ name: "draft_test_drive_request", label: `Drafted a drive for ${vehicleName(vehicle)}` });
  };

  useEffect(() => {
    const controller = new AbortController();
    registerShowroomTools({
      onActivity: addActivity,
      onSearch: (filters) => {
        const result = searchInventory(filters);
        setMatches(result);
        setSelectedIds(result.slice(0, 2).map((vehicle) => vehicle.id));
        if (result[0]) setFocusedVehicle(result[0]);
        return {
          matches: result,
          summary: result.length ? `${result.length} vehicles match the current brief.` : "No vehicles match.",
        };
      },
      onCompare: (ids) => {
        const selected = compareVehicles(ids);
        setSelectedIds(selected.map((vehicle) => vehicle.id));
        if (selected[0]) setFocusedVehicle(selected[0]);
        return {
          vehicles: selected,
          summary: `Comparison ready for ${selected.length} vehicles.`,
        };
      },
      onTradeIn: (input) => {
        const estimate = createTradeInEstimate(input);
        setTradeIn(estimate);
        return estimate;
      },
      onDraftRequest: (input) => {
        const vehicle = getDraftVehicle(input.vehicleId);
        if (!vehicle) return { vehicle: null, status: "vehicle_not_found", message: "Vehicle not found in this showroom." };
        setDraft({
          vehicle,
          customerName: input.customerName ?? "",
          preferredDay: input.preferredDay ?? "Tomorrow",
          preferredTime: input.preferredTime ?? "Late afternoon",
          saved: false,
        });
        return { vehicle, status: "draft_ready", message: `Draft ready for ${vehicleName(vehicle)}.` };
      },
    }, controller.signal)
      .then((registered) => setWebMcpStatus(registered ? "ready" : "browser"))
      .catch(() => setWebMcpStatus("error"));

    return () => controller.abort();
  }, []);

  const comparison = useMemo(() => compareVehicles(selectedIds), [selectedIds]);
  const visibleMatches = showAll ? matches : matches.slice(0, 3);

  const updateDraft = (key: "customerName" | "preferredDay" | "preferredTime", value: string) => {
    setDraft((current) => current ? { ...current, [key]: value, saved: false } : current);
  };

  return (
    <main>
      <nav className="topbar shell">
        <a className="wordmark" href="#top" aria-label="OneSolutionDealer home">
          <span className="wordmark-mark">OSD</span>
          <span>OneSolutionDealer</span>
        </a>
        <div className="topbar-right">
          <span className="demo-pill"><span className="demo-dot" /> Synthetic showroom</span>
          <a className="nav-link" href="#how-it-works">How it works <span>↓</span></a>
        </div>
      </nav>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <p className="eyebrow">A WebMCP showroom experiment · 01</p>
          <h1>The shortest path from <em>maybe</em> to “book a drive.”</h1>
          <p className="hero-lede">
            A dealer showroom designed for people and their agents to choose together — with useful shortcuts, visible reasoning and a human hand on the wheel.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => workspaceRef.current?.scrollIntoView({ behavior: "smooth" })}>
              Try the agent desk <span>↓</span>
            </button>
            <span className="hero-note"><span className="note-line" /> No real messages or bookings</span>
          </div>
        </div>
        <div className="hero-art" aria-label="A visual summary of the human and agent workflow">
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <div className="hero-card hero-card-agent">
            <span className="mini-label">AGENT BRIEF</span>
            <p>“SUV, automatic, under €25k. I’d like to trade in my old hatchback.”</p>
            <span className="hero-card-arrow">↘</span>
          </div>
          <div className="hero-card hero-card-human">
            <span className="mini-label">HUMAN CHECK</span>
            <p>Two strong fits. Want to compare comfort, running costs or boot space?</p>
            <span className="hero-avatar">G</span>
          </div>
          <div className="hero-spark">✦</div>
          <span className="hero-caption">A showroom that can listen<br />without taking over.</span>
        </div>
      </section>

      <section className="tool-ribbon shell" id="how-it-works">
        <div className="ribbon-intro">
          <span className="ribbon-kicker">The agent can</span>
          <strong>make the first move.</strong>
        </div>
        <div className="tool-list">
          {[
            ["01", "Search", "find_inventory"],
            ["02", "Compare", "compare_vehicles"],
            ["03", "Estimate", "evaluate_trade_in"],
            ["04", "Prepare", "draft_test_drive_request"],
          ].map(([number, label, name]) => (
            <div className="tool-chip" key={name}>
              <span>{number}</span>
              <div><strong>{label}</strong><small>{toolLabel(name)}</small></div>
            </div>
          ))}
        </div>
      </section>

      <section className="workspace shell" ref={workspaceRef}>
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">The agent desk</p>
            <h2>Start with a thought,<br /><em>not a filter.</em></h2>
          </div>
          <div className={`mcp-status mcp-status-${webMcpStatus}`}>
            <span className="status-icon">{webMcpStatus === "ready" ? "✦" : "○"}</span>
            <div>
              <strong>{webMcpStatus === "ready" ? "WebMCP ready" : webMcpStatus === "browser" ? "Preview mode" : "Connecting WebMCP"}</strong>
              <span>{webMcpStatus === "ready" ? "4 tools registered on this page" : "Enable the WebMCP browser flag to call tools"}</span>
            </div>
          </div>
        </div>

        <div className="desk-grid">
          <div className="agent-panel">
            <div className="panel-topline">
              <span className="panel-icon">✦</span>
              <span>Agent brief</span>
              <span className="panel-live">LIVE DEMO</span>
            </div>
            <div className="prompt-bubble">
              <span className="quote-mark">“</span>
              <textarea value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Describe the car you are looking for" rows={3} />
            </div>
            <div className="suggestion-row">
              <button onClick={() => { setQuery("Elettrica con più di 500 km di autonomia"); runSearch({ fuel: "Electric" }, "Found electric options"); }}>Long-range electric</button>
              <button onClick={() => { setQuery("Diesel automatico per viaggi lunghi"); runSearch({ fuel: "Diesel", transmission: "Automatic" }, "Found long-distance options"); }}>Long-distance diesel</button>
              <button onClick={() => { setQuery("Sotto 23.000 €"); runSearch({ maxPrice: 23000 }, "Found value options"); }}>Best value</button>
            </div>
            <button className="search-button" onClick={onManualSearch}>Find my shortlist <span>→</span></button>
            <div className="agent-footer">
              <span><span className="footer-dot" /> Human in the loop</span>
              <span>Tool calls stay visible</span>
            </div>
          </div>

          <div className="activity-panel">
            <div className="panel-topline">
              <span className="panel-icon panel-icon-muted">⌁</span>
              <span>What the agent is doing</span>
              <span className="activity-count">{activity.length || "—"}</span>
            </div>
            {activity.length ? (
              <div className="activity-list">
                {activity.map((item, index) => (
                  <div className={`activity-row activity-row-${index}`} key={item.id}>
                    <span className="activity-check">✓</span>
                    <div><strong>{item.label}</strong><small><code>{item.name}</code> · now</small></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="activity-empty">
                <span className="empty-orbit">◌</span>
                <p>Your actions will appear here as tool calls.</p>
              </div>
            )}
            <div className="activity-note"><span>↳</span> The agent can prepare. You decide.</div>
          </div>
        </div>

        <div className="results-heading">
          <div>
            <span className="result-count">{matches.length.toString().padStart(2, "0")} MATCHES</span>
            <h2>Your shortlist</h2>
          </div>
          <p>Curated from the demo inventory<br />around Emilia-Romagna.</p>
        </div>

        {visibleMatches.length ? (
          <div className="vehicle-grid">
            {visibleMatches.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                selected={selectedIds.includes(vehicle.id)}
                onToggleCompare={() => toggleCompare(vehicle.id)}
                onDraft={() => openDraft(vehicle)}
                onFocus={() => setFocusedVehicle(vehicle)}
              />
            ))}
          </div>
        ) : (
          <div className="no-results"><span>⌁</span><h3>Nothing in this lane yet.</h3><p>Try loosening the budget or changing the fuel type.</p><button className="text-button" onClick={() => { setQuery("Cerco un SUV automatico sotto 25.000 €"); runSearch({ body: "SUV", transmission: "Automatic", maxPrice: 25000 }, "Reset the brief"); }}>Reset the brief ↗</button></div>
        )}
        {matches.length > 3 && <button className="load-more" onClick={() => setShowAll((current) => !current)}>{showAll ? "Show less" : `See all ${matches.length} matches`} <span>{showAll ? "↑" : "↓"}</span></button>}
      </section>

      <section className="compare-section shell">
        <div className="compare-header">
          <div>
            <p className="eyebrow">A clearer next step</p>
            <h2>Compare with context.</h2>
          </div>
          <p className="compare-description">The agent brings the shortlist together. Your judgement chooses what matters.</p>
        </div>
        <div className="compare-board">
          <div className="compare-label-column">
            <span className="compare-label-title">SHORTLIST</span>
            <span>Price</span><span>Powertrain</span><span>On the road</span><span>Where to see it</span>
          </div>
          {comparison.length ? comparison.map((vehicle) => (
            <div className="compare-vehicle" key={vehicle.id}>
              <VehicleArt vehicle={vehicle} compact />
              <strong>{vehicleName(vehicle)}</strong>
              <span>{formatPrice(vehicle.price)}</span>
              <span>{vehicle.fuel} · {vehicle.transmission}</span>
              <span>{vehicle.fitNote.split(":")[0]}</span>
              <span>{vehicle.location}</span>
            </div>
          )) : <div className="compare-empty">Choose vehicles above to build a comparison.</div>}
        </div>
        <div className="compare-bottomline">
          <span><span className="tiny-star">✦</span> {comparison.length} of 3 comparison slots used</span>
          <span>Structured output, human judgement</span>
        </div>
      </section>

      <section className="handoff shell">
        <div className="handoff-copy">
          <p className="eyebrow">The handoff</p>
          <h2>Good agents know<br />when to <em>pause.</em></h2>
          <p>Once a car feels right, the agent can prepare a request. It cannot send it. That last inch belongs to the person who will actually take the wheel.</p>
          <div className="handoff-rule" />
          <span className="handoff-caption">No booking. No message. No surprise.</span>
        </div>
        <div className="handoff-card">
          <div className="handoff-card-top"><span>REQUEST READY</span><span className="draft-status">DRAFT</span></div>
          <div className="handoff-car-row">
            <VehicleArt vehicle={focusedVehicle} compact />
            <div><span className="eyebrow eyebrow-small">Your current focus</span><h3>{vehicleName(focusedVehicle)}</h3><p>{focusedVehicle.location} · {formatPrice(focusedVehicle.price)}</p></div>
          </div>
          <div className="handoff-divider" />
          <div className="handoff-fields"><span>Preferred day</span><strong>Tomorrow</strong><span>Preferred time</span><strong>Late afternoon</strong></div>
          <button className="secondary-button" onClick={() => openDraft(focusedVehicle)}>Review the draft <span>→</span></button>
        </div>
      </section>

      {tradeIn && <div className="toast-card"><span className="toast-icon">↗</span><div><strong>Indicative trade-in range</strong><p>{tradeIn.range} · {tradeIn.note}</p></div><button onClick={() => setTradeIn(null)} aria-label="Dismiss trade-in estimate">×</button></div>}

      {draft && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDraft(null)}>
          <section className="draft-modal" role="dialog" aria-modal="true" aria-labelledby="draft-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setDraft(null)} aria-label="Close draft">×</button>
            <p className="eyebrow">Human review · draft only</p>
            <h2 id="draft-title">Prepare a test drive.</h2>
            <p className="modal-lede">The agent has gathered the details. Check them, then save this local demo request.</p>
            <div className="modal-vehicle"><VehicleArt vehicle={draft.vehicle} compact /><div><span className="eyebrow eyebrow-small">Selected vehicle</span><h3>{vehicleName(draft.vehicle)}</h3><p>{draft.vehicle.trim} · {formatPrice(draft.vehicle.price)}</p></div></div>
            <label>Name <input value={draft.customerName} onChange={(event) => updateDraft("customerName", event.target.value)} placeholder="Your name" /></label>
            <div className="field-row"><label>Preferred day <select value={draft.preferredDay} onChange={(event) => updateDraft("preferredDay", event.target.value)}><option>Tomorrow</option><option>Saturday</option><option>Next week</option></select></label><label>Preferred time <select value={draft.preferredTime} onChange={(event) => updateDraft("preferredTime", event.target.value)}><option>Morning</option><option>Late afternoon</option><option>Evening</option></select></label></div>
            <div className="modal-safety"><span>✓</span><p>This is a local demo. Saving does not contact the dealer or create a real appointment.</p></div>
            {draft.saved ? <div className="saved-state"><span>✦</span><div><strong>Draft saved in the showroom.</strong><p>That’s the handoff. A real dealer would take it from here.</p></div></div> : <button className="primary-button modal-submit" onClick={() => setDraft((current) => current ? { ...current, saved: true } : current)}>Save demo draft <span>→</span></button>}
          </section>
        </div>
      )}

      <footer className="footer shell">
        <div><span className="wordmark-mark">OSD</span><span>OneSolutionDealer</span></div>
        <p>Built for the WebMCP Challenge · Human-first by design</p>
        <span className="footer-tag">DEMO DATA ONLY</span>
      </footer>
    </main>
  );
}
