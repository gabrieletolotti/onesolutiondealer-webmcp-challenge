# The Dealer's Desk

OneSolutionDealer's WebMCP Challenge demo: an automotive showroom designed for people and their agents to choose together.

## Live demo

[Open The Dealer's Desk](https://onesolutiondealer-webmcp-challenge.vercel.app/)

## The idea

The Dealer's Desk turns a natural-language car brief into a transparent, human-controlled shopping flow:

1. Search a synthetic dealer inventory with structured criteria.
2. Compare up to three vehicles with context, not just specs.
3. Prepare an indicative trade-in range.
4. Draft a test-drive request for human review.

The last action is deliberately draft-only. This demo does not send messages, create appointments, access customer data, or connect to a live dealership account.

## WebMCP tools

The public page registers four tools when opened in a WebMCP-capable browser:

- `search_inventory`
- `compare_vehicles`
- `evaluate_trade_in`
- `draft_test_drive_request`

The tools use the imperative WebMCP API and return structured JSON-friendly values. They execute against the visible page's synthetic inventory so an agent and a person share the same showroom context.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To test WebMCP in Chrome, enable `chrome://flags/#enable-webmcp-testing` and relaunch the browser. The page remains fully usable as a normal showroom without WebMCP.

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Repository

This is a standalone, open-source challenge demo. It intentionally does not contain the private OneSolutionDealer application, its history, credentials, customer data, or production integrations.

## License

MIT. See [LICENSE](./LICENSE).
