# Native WebMCP test

The Dealer's Desk is designed to be testable in a WebMCP-capable browser without credentials or real customer data.

## Setup

1. Open the live demo in Google Chrome.
2. Enable `chrome://flags/#enable-webmcp-testing` and relaunch Chrome if the page shows `Preview mode`.
3. Reload the live demo. The status card should say `WebMCP ready` and `4 tools registered`.

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
    "make": "Volkswagen",
    "model": "Golf",
    "year": 2019,
    "mileage": 70000
  }
}
```

The page should show an indicative range with an explicit review note.

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
