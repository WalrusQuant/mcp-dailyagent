# VPS Deploy (from source)

> **Most users should follow the [quick-start guide](quick-start.md) instead.** It uses the prebuilt container image, skips the clone + build step, and runs migrations automatically. This page is for contributors who want to build the image from source or customize it.

End-to-end deployment for a self-hosted single-user VPS. The dashboard is reachable via Tailscale only; the MCP server is protected by a bearer token (`MCP_API_KEY`).

## Prerequisites on the VPS

- **Docker Engine** + **Docker Compose v2** ([install guide](https://docs.docker.com/engine/install/))
- **Tailscale** ([install guide](https://tailscale.com/download)) — for gating dashboard access
- **git**

You do not need Node.js installed on the VPS. Everything runs inside containers.

## One-time setup

### 1. Clone the repo

```bash
git clone https://github.com/WalrusQuant/mcp-dailyagent.git
cd mcp-dailyagent
```

### 2. Generate secrets + write `.env`

```bash
cat > .env <<EOF
# Database (internal — only reachable inside the Docker network)
DATABASE_URL=postgres://dailyagent:$(openssl rand -hex 16)@postgres:5432/dailyagent
POSTGRES_USER=dailyagent
POSTGRES_PASSWORD=<paste the password from DATABASE_URL>
POSTGRES_DB=dailyagent

# Single-user identity — fresh UUID
SELF_HOSTED_USER_ID=$(node -e "console.log(require('crypto').randomUUID())" 2>/dev/null || uuidgen)

# MCP bearer token — 32 random bytes hex
MCP_API_KEY=$(openssl rand -hex 32)
EOF
```

Edit `.env` to make the `POSTGRES_PASSWORD` match the password in `DATABASE_URL`, and save a copy of the file somewhere safe — it contains all your secrets.

Compose auto-loads `.env`, so no `--env-file` flag needed.

### 3. Build + start everything

```bash
docker compose up -d --build
```

On first boot the app container's entrypoint waits for Postgres to be healthy, runs any pending Drizzle migrations, and seeds the `profiles` row for `SELF_HOSTED_USER_ID` (idempotent — safe on every restart). No manual migrate/seed step needed.

Watch the logs until you see `Ready in Xms`:

```bash
docker compose logs -f app
```

Verify:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard
# 200
```

### 4. Tailscale

```bash
sudo tailscale up
```

Follow the auth link. Once joined, the dashboard is reachable at `http://<vps-hostname>:3000` from any device on your tailnet. Magic DNS makes this a nice name like `http://vps:3000`.

**Firewall the public port:**

```bash
sudo ufw deny 3000/tcp
# or whatever firewall you use — just make sure 3000 is not publicly exposed
```

The compose file already binds Postgres and the app to `127.0.0.1`, so neither is reachable from outside the VPS unless you poke a hole in the firewall. Tailscale's wireguard interface sidesteps that restriction and only lets your tailnet in.

## OpenClaw connection

OpenClaw needs one MCP server entry pointing at the VPS's tailnet address with the bearer token you saved in `.env`.

Example OpenClaw MCP config (the exact format depends on your OpenClaw skill/config layer — adapt as needed):

```json
{
  "mcpServers": {
    "dailyagent": {
      "url": "http://<vps-tailnet-name>:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_API_KEY from .env>"
      }
    }
  }
}
```

Verify from your laptop (on the tailnet):

```bash
curl -s -X POST -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}' \
  http://<vps-tailnet-name>:3000/api/mcp
```

You should get back a JSON-RPC response listing server capabilities.

## Day-to-day operations

**Update to latest code:**

```bash
cd mcp-dailyagent
git pull
docker compose up -d --build app
```

The entrypoint runs any pending migrations on container start.

**View logs:**

```bash
docker compose logs -f app
docker compose logs -f postgres
```

**Back up the database:**

```bash
docker compose exec -T postgres pg_dump -U dailyagent dailyagent | gzip > backup-$(date +%F).sql.gz
```

**Restore:**

```bash
gunzip -c backup-YYYY-MM-DD.sql.gz | docker compose exec -T postgres psql -U dailyagent dailyagent
```

**Wipe all productivity data (keeping schema + profile):**

Use the Danger Zone in Settings → "Wipe All Data". Or directly:

```bash
docker compose exec -T postgres psql -U dailyagent dailyagent <<'EOF'
TRUNCATE tasks, habits, habit_logs, journal_entries, workout_templates,
  workout_exercises, workout_logs, workout_log_exercises, focus_sessions,
  goals, goal_progress_logs, spaces, tags, weekly_reviews,
  daily_briefings, insight_cache CASCADE;
EOF
```

## Troubleshooting

- **App can't reach Postgres** — check `DATABASE_URL` hostname is `postgres` (the compose service name), not `localhost`.
- **`SELF_HOSTED_USER_ID is not set`** — the app container didn't pick up `.env`. Make sure the file is named exactly `.env` (not `.env.local`) in the same directory as `docker-compose.yml`, or use `docker compose --env-file <path> up`.
- **MCP 401** — `MCP_API_KEY` in `.env` doesn't match the `Authorization: Bearer` header from the client.
- **Dashboard shows no data after wipe** — check `profiles` row still exists (`docker compose exec postgres psql -U dailyagent -c "SELECT * FROM profiles"`). If it's gone, `docker compose restart app` — the entrypoint re-seeds it.
