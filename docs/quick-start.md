# Quick start

Stand up your instance in about five minutes using the prebuilt container image. No cloning, no Node install, no local build.

## Prerequisites

- A host with **Docker Engine + Docker Compose v2** (any Linux VPS, Raspberry Pi, Apple Silicon Mac, etc. — the image is multi-arch)
- **Tailscale** (or another way to reach the host privately — the dashboard has no login; Tailscale *is* the auth layer)
- An **OpenClaw** install somewhere (your laptop, another VPS — wherever you run the agent)

## 1. Grab the compose + env files

```bash
mkdir cadence && cd cadence

curl -o docker-compose.yml \
  https://raw.githubusercontent.com/WalrusQuant/cadence/main/docker-compose.example.yml

curl -o .env \
  https://raw.githubusercontent.com/WalrusQuant/cadence/main/.env.example
```

## 2. Fill in `.env`

Open `.env` and set three values:

```bash
# A fresh UUID (run `uuidgen` or `python -c "import uuid; print(uuid.uuid4())"`)
SELF_HOSTED_USER_ID=<paste UUID>

# A long random string — the bearer token OpenClaw sends on every request
MCP_API_KEY=<paste `openssl rand -hex 32`>

# Any strong password — protects the built-in Postgres
POSTGRES_PASSWORD=<paste something random>
```

Everything else has a sensible default. Back the file up somewhere safe — it contains every secret.

## 3. Start it

```bash
docker compose up -d
```

The first boot:
- Pulls the image (GHCR, multi-arch)
- Waits for Postgres
- Runs any pending Drizzle migrations
- Seeds your profile row (idempotent — safe on restart)
- Starts Next.js

Takes about 15 seconds. Watch the logs:

```bash
docker compose logs -f app
```

You should see `Ready in Xms`.

## 4. Verify it's alive

Two curls confirm the stack is healthy before you touch OpenClaw config.

**Health endpoint** (no auth, no body):

```bash
curl -s http://localhost:3000/api/mcp/health | jq
```

Expected — `ok: true`, the transport name, and surface counts:

```json
{
  "ok": true,
  "transport": "streamable-http",
  "tools": 45,
  "prompts": 13,
  "resources": 15,
  "version": "0.1.0"
}
```

**Authenticated `tools/list`** (uses the bearer token from `.env`):

```bash
source .env
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | jq '.result.tools | length'
```

Expected output: a number matching `tools` from the health endpoint (e.g. `45`). If you get `null` or an error, double-check `MCP_API_KEY` matches what's in `.env`.

## 5. Tailscale + firewall

```bash
sudo tailscale up          # follow the auth link
sudo ufw deny 3000/tcp     # or your firewall of choice
```

The compose file binds Postgres and the app to `127.0.0.1` so neither is reachable from the public internet. Tailscale's WireGuard interface is what lets your tailnet devices in.

To expose the dashboard on your tailnet IP instead of localhost, edit the `app.ports` line in `docker-compose.yml`:

```yaml
    ports:
      - "100.x.y.z:3000:3000"   # your Tailscale IP
```

Then `docker compose up -d`.

## 6. Hook OpenClaw up

Add this block to your OpenClaw MCP config (alongside any other MCP servers you've registered):

```json
"cadence": {
  "url": "http://<tailscale-name>:3000/api/mcp",
  "transport": "streamable-http",
  "headers": {
    "Authorization": "Bearer <MCP_API_KEY>"
  }
}
```

> **Transport must be `streamable-http`.** The server does not implement the legacy SSE transport — configuring `"transport": "sse"` will silently fail to discover tools.

Then drop the [skill file](openclaw-skill.md) into OpenClaw's skills directory so the agent knows what tools are available, and restart the gateway.

Verify from another tailnet device:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}' \
  http://<tailscale-name>:3000/api/mcp
```

A JSON-RPC response listing server capabilities means it's working.

## You're done

Visit `http://<tailscale-name>:3000` from any Tailscale-connected device. Ask OpenClaw to "create a task called verify mcp write path" — if it returns without an error, your agent can write to the DB.

## Updating

```bash
docker compose pull && docker compose up -d
```

That's it. Migrations run automatically on container start.

## Image sources

Pulled by default from GHCR:

```
ghcr.io/walrusquant/cadence:latest
```

Mirrored to Docker Hub if you prefer:

```
docker.io/walrusquant/cadence:latest
```

Available tags: `:latest` (tracks `main`), `:1` / `:1.0` / `:1.0.0` (semver — `:1` floats within the v1 major, `:1.0` within v1.0, `:1.0.0` is an exact pin), and `:sha-<short>` for a pin to a specific commit. Pin to `:1` for safe auto-upgrades within the major version.

## What next

- **[Architecture](architecture.md)** — understand what you just deployed
- **[MCP reference](mcp-reference.md)** — browse the tools OpenClaw can call
- **[Troubleshooting](troubleshooting.md)** — if something above failed
- **[Backup & restore](backup-restore.md)** — don't skip this
- **[Deploy from source](DEPLOY.md)** — if you want to build your own image instead of using the prebuilt one
