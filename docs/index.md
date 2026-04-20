# Daily Agent MCP

**Hardened productivity data layer for [OpenClaw](https://openclaw.ai).**
Postgres behind a typed MCP interface, plus a Next.js dashboard that reads and edits the same database. Self-hosted, single-user, Tailscale-gated.

!!! info "Not a chatbot"
    This project is *not* an AI product. It's a durable store for tasks, habits, journal, workouts, focus sessions, goals, and spaces — exposed to your agent over MCP and to your browser over HTTP. All generative AI (briefings, reviews, insights) lives in OpenClaw.

---

## The shape of it

Two front doors, one database.

```mermaid
flowchart TD
    OC[OpenClaw agent] -->|/api/mcp + Bearer| MCP["/api/mcp<br/>MCP server"]
    UI[Browser dashboard] -->|"/tasks, /habits, ..."| API[Next.js API routes]
    MCP -->|Drizzle| DB[(Postgres)]
    API -->|Drizzle| DB
```

- **MCP server** (`/api/mcp`) — the agent's interface. 34 typed tools for reading and writing every piece of productivity data, 13 prompt templates, plus read-only resources. Bearer-token authenticated.
- **Dashboard** — a Next.js UI for browsing and manually editing the same data. No AI features. No generate buttons. Just CRUD.

OpenClaw owns model choice, scheduling, message delivery (Telegram / WhatsApp / etc.), briefings, insights, and reviews. This repo owns storage and the contract.

## Who this is for

You if:

- You're already running OpenClaw (or a similar agent) and want it to stop writing data into a pile of markdown templates and scripts.
- You want your productivity data in **one Postgres database** you control, not scattered across a dozen services.
- You're comfortable running Docker + Compose on a VPS and putting it behind Tailscale.
- You want a simple browser UI to poke at the data without opening a SQL shell.

## Where to go next

<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } **Quick start**

    ---

    The short path: clone, `.env`, compose up, you're done.

    [:octicons-arrow-right-24: Get running](quick-start.md)

-   :material-server:{ .lg .middle } **Full VPS walkthrough**

    ---

    Docker, Compose, Tailscale, OpenClaw wiring — every step spelled out.

    [:octicons-arrow-right-24: Deploy guide](DEPLOY.md)

-   :material-api:{ .lg .middle } **MCP reference**

    ---

    34 tools, grouped by domain, with input schemas and examples.

    [:octicons-arrow-right-24: Browse tools](mcp-reference.md)

-   :material-puzzle:{ .lg .middle } **OpenClaw integration**

    ---

    The skill file OpenClaw needs, plus usage patterns.

    [:octicons-arrow-right-24: Skill setup](openclaw-skill.md)

-   :material-sitemap:{ .lg .middle } **Architecture**

    ---

    Request flow, auth layers, data model, where validation happens.

    [:octicons-arrow-right-24: Under the hood](architecture.md)

-   :material-wrench:{ .lg .middle } **Troubleshooting**

    ---

    401s, connection refused, port conflicts, MCP schema errors.

    [:octicons-arrow-right-24: Fix it](troubleshooting.md)

</div>

## License

Personal use. Modify and self-host freely. No redistribution of source.
