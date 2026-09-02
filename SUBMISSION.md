# Devpost submission draft

## Project title

The Dealer's Desk

## Short description

A human-first automotive showroom where people and AI agents can search inventory, compare cars, estimate a trade-in, and prepare a test-drive request together.

## Inspiration

Buying a car rarely begins with a perfect form. It begins with a thought: “I need an automatic SUV, I have a trade-in, and I do not know where to start.” The Dealer's Desk turns that thought into structured, inspectable progress without hiding the human decision at the end.

## What it does

The experience combines a natural-language agent brief with a clear showroom UI. An agent can call four page-level WebMCP tools:

- `search_inventory` finds matches in a synthetic Emilia-Romagna dealer inventory.
- `compare_vehicles` returns a contextual comparison, not just a list of fields.
- `evaluate_trade_in` prepares an indicative range with explicit assumptions.
- `draft_test_drive_request` prepares a request for human review.

The interface shows the same work to the person: the active brief, the shortlist, the comparison board, the trade-in context, and the final handoff. Every action in the demo is draft-only: no message is sent, no appointment is booked, and no real lead is created.

## How we built it

The public repository is a small Next.js application with a typed synthetic inventory, client-side WebMCP feature detection, and four structured tools registered through `document.modelContext`. The UI is intentionally usable without an agent, while capable browsers can discover the same actions as tools.

## Why WebMCP matters here

WebMCP lets a website expose capabilities instead of forcing an agent to guess through clicks and visual labels. The Dealer's Desk uses that capability to make the first steps of a dealership journey more useful while keeping scope visible and human-controlled.

## Links

- Live demo: https://onesolutiondealer-webmcp-challenge.vercel.app/
- Source code: https://github.com/gabrieletolotti/onesolutiondealer-webmcp-challenge
- Demo video: add the YouTube or other public video URL after upload.

## Demo video

The local production-ready demo video is generated at `artifacts/The-Dealers-Desk-WebMCP-demo.mp4`. Its narration uses the macOS Samantha TTS voice and follows the same flow shown in the app.

## Final checklist

- [ ] Upload `artifacts/The-Dealers-Desk-WebMCP-demo.mp4` to a public or unlisted video host.
- [ ] Paste the public video URL in the Devpost submission.
- [ ] Confirm that the live demo and public repository links are reachable in a private browser window.
- [ ] Submit the Devpost entry.
