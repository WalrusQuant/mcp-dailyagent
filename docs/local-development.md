# Local development

> **Just want to run an instance for personal use on your laptop?** Follow the [quick-start](quick-start.md) instead — Docker handles everything. This page is for **contributors hacking on the source code** (changing the dashboard, adding MCP tools, debugging the schema, etc.) where you need a hot-reloading `npm run dev` setup.

Setup for running the dashboard + MCP server on your laptop against a local Postgres.

## Requirements

- **Node.js 22+** (the Dockerfile uses 20; 22 is fine for local)
- **Postgres 16** running somewhere you can reach (`localhost:5432` works)
- **npm**

## 1. Install deps

```bash
git clone https://github.com/WalrusQuant/mcp-dailyagent.git
cd mcp-dailyagent
npm install
```

## 2. `.env.local`

```bash
cat > .env.local <<EOF
DATABASE_URL=postgres://dailyagent:dailyagent@localhost:5432/dailyagent
SELF_HOSTED_USER_ID=$(node -e "console.log(require('crypto').randomUUID())")
MCP_API_KEY=$(openssl rand -hex 32)
EOF
```

If you already have Postgres running but not the `dailyagent` user/database, create them:

```bash
createuser dailyagent
createdb -O dailyagent dailyagent
psql -d dailyagent -c "ALTER USER dailyagent WITH PASSWORD 'dailyagent';"
```

Or just run the compose `postgres` service and point `DATABASE_URL` at it:

```bash
docker compose up -d postgres
# DATABASE_URL stays pointed at localhost:5432
```

## 3. Schema + profile

```bash
npm run db:migrate
```

Then seed the single-user profile:

```bash
source .env.local
psql "$DATABASE_URL" <<EOF
INSERT INTO profiles (id, email, display_name, is_admin)
VALUES ('$SELF_HOSTED_USER_ID', 'you@example.com', 'You', true)
ON CONFLICT (id) DO NOTHING;
EOF
```

## 4. Run

```bash
npm run dev
```

- Dashboard: <http://localhost:3000>
- MCP: <http://localhost:3000/api/mcp>
- Hot reload via Turbopack

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack, hot reload) |
| `npm run build` | Production build (standalone output, for Docker) |
| `npm start` | Start the built app |
| `npm run lint` | ESLint over everything |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run db:generate` | Generate a new Drizzle migration from `schema.ts` diff |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema directly (skip migrations — **dev only**) |
| `npm run db:studio` | Open Drizzle Studio (browser-based DB inspector) |

## Drizzle Studio

```bash
npm run db:studio
```

Opens a local web UI at a URL it prints (typically `https://local.drizzle.studio`) where you can browse and edit tables. Useful for seeding test data, inspecting what a tool wrote, or sanity-checking CHECK constraints.

## Testing against the MCP endpoint

With the dev server running:

```bash
source .env.local
curl -s -X POST \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}' \
  http://localhost:3000/api/mcp
```

You should see a JSON-RPC response listing the server's capabilities and 34 tools.

List tasks:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_tasks","arguments":{}}}' \
  http://localhost:3000/api/mcp
```

## Adding a new tool

1. Open the relevant file under `src/lib/mcp/tools/` (or create a new one and register it in `src/lib/mcp/server.ts`).
2. Write the tool with `server.tool(name, description, inputSchema, handler)`. Use shared schemas from `src/lib/mcp/tools/validators.ts` where they apply.
3. If the handler writes to the DB, make sure the tool's Zod input schema matches every relevant CHECK constraint in `src/lib/db/schema.ts`. Mismatched schemas are the #1 cause of "works in curl, fails in the agent" bugs.
4. Add a scope to `src/lib/oauth-scopes.ts` if it's a new domain.
5. Update [MCP reference](mcp-reference.md) and [OpenClaw skill file](openclaw-skill.md).
6. `npm test` + `npm run lint`.

## Changing the schema

```bash
# 1. Edit src/lib/db/schema.ts
# 2. Generate a migration:
npm run db:generate
# 3. Review drizzle/<timestamp>_*.sql
# 4. Apply:
npm run db:migrate
```

If you add or change a `CHECK` constraint, update the matching validator in `src/lib/mcp/tools/validators.ts` so the tool schema stays in sync with the DB.

## Resetting the DB

Quickest path — drop and recreate the public schema:

```bash
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:migrate
# re-seed profile
```

With the compose Postgres service:

```bash
docker compose down
docker volume rm mcp-dailyagent_dailyagent_pgdata
docker compose up -d postgres
npm run db:migrate
# re-seed profile
```

## Running the production build locally

```bash
npm run build
NODE_ENV=production npm start
```

Useful for verifying the `next build` standalone output behaves the same as in Docker before pushing.

## Docker compose, but local

If you want to run the full container stack on your laptop (useful for reproducing a deploy issue):

```bash
cp .env.local .env   # compose reads .env
docker compose up -d --build
```

The container's entrypoint waits for Postgres, runs migrations, and seeds the profile row automatically. App lands at `http://localhost:3000` (compose binds to `127.0.0.1:3000` by default).
