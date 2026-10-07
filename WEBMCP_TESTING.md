# Native WebMCP test

The Dealer's Desk is designed to be testable in a WebMCP-capable browser without credentials or real customer data.

## Setup

1. Open the target deployment in a WebMCP-capable browser (for example a compatible Chrome release) with an agent/consumer that can discover and execute page tools.
2. Enable `chrome://flags/#enable-webmcp-testing` and relaunch Chrome if the page shows `Preview mode`.
3. Reload the target deployment. The status card should say `WebMCP ready` and `4 tools registered`. This proves registration only; complete the calls below to verify execution and visible state.

See the [current Chrome API documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api) for version-specific discovery and invocation support. Consumers may assign document-specific suffixes to tool names; use the names they actually discover.

## Smoke test

Ask an agent that can inspect page tools to run these calls in order:

```json
{
  "tool": "search_inventory",
  "input": {
    "body": "SUV",
    "transmission": "Automatic",
    "maxPrice": 25000
  }
}
```

The shortlist and the activity panel should update on the page.

```json
{
  "tool": "compare_vehicles",
  "input": {
    "vehicleIds": ["volvo-xc40", "cupra-formentor"]
  }
}
```

The comparison board should show the two selected vehicles.

```json
{
  "tool": "evaluate_trade_in",
  "input": {
    "year": 2019,
    "mileage": 70000
  }
}
```

The page should show a fictional range and explicitly state that it is not a vehicle valuation. The formula uses only year and mileage; there is no market, make/model or condition assessment.

```json
{
  "tool": "draft_test_drive_request",
  "input": {
    "vehicleId": "volvo-xc40",
    "preferredDay": "Saturday",
    "preferredTime": "Late afternoon"
  }
}
```

The human-review draft should open. Nothing is sent, booked, or persisted outside the page.

If WebMCP is unavailable, the normal showroom controls remain fully usable in Preview mode.

## Negative cases

For every invalid input, expect `status: "invalid_input"` (or rejection by the browser's JSON Schema validator) and no changes to the existing shortlist, comparison, estimate or draft. The page activity should identify rejected input, without a success checkmark, when the executor receives it.

- Search: negative/non-numeric budget, invalid enum, extra fields. A valid zero budget must return no matches.
- Compare: empty array, unknown ID, duplicate IDs, more than three IDs. Valid comparison order must follow the input, including vehicles outside the current shortlist.
- Simulation: missing year/mileage, year outside 1900–current year, fractional year, negative/non-finite mileage. No price should be produced.
- Draft: invalid day/time or missing vehicle ID. An unknown string ID returns `vehicle_not_found` and preserves any existing draft.
- Lifecycle: reload/unmount removes the previous document's tools; aborted executions must not update the page. A registration failure must not leave a partially active tool set.

## Record the experiment

Record deployment URL/SHA, browser/consumer, discovered tools, native results and corresponding visible state. Count the four successful task completions separately from negative-case rejections. Unit tests with a mocked registry prove the application boundary, not native browser discovery/invocation.
