# Quick start

Stand up your instance in about five minutes using the prebuilt container image. No cloning, no Node install, no local build.

## Prerequisites

- A host with **Docker Engine + Docker Compose v2** (any Linux VPS, Raspberry Pi, Apple Silicon Mac, etc. — the image is multi-arch)
- **Tailscale** (or another way to reach the host privately — the dashboard has no login; Tailscale *is* the auth layer)
- An **OpenClaw** install somewhere (your laptop, another VPS — wherever you run the agent)

## 1. Grab the compose + env files

```bash
mkdir mcp-dailyagent && cd mcp-dailyagent

curl -o docker-compose.yml \
  https://raw.githubusercontent.com/WalrusQuant/mcp-dailyagent/main/docker-compose.example.yml

curl -o .env \
  https://raw.githubusercontent.com/WalrusQuant/mcp-dailyagent/main/.env.example
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

## 4. Tailscale + firewall

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

## 5. Hook OpenClaw up

Point OpenClaw at `http://<tailscale-name>:3000/api/mcp` with `Authorization: Bearer <MCP_API_KEY>`. Drop the [skill file](openclaw-skill.md) into OpenClaw's skills directory so the agent knows what tools are available.

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
ghcr.io/walrusquant/mcp-dailyagent:latest
```

Mirrored to Docker Hub if you prefer:

```
docker.io/walrusquant/mcp-dailyagent:latest
```

Available tags: `:latest` (tracks `main`) and `:sha-<short>` for an exact commit pin. Once a semver release is cut, floating tags like `:v1`, `:v1.2`, and exact pins like `:v1.2.3` will also be published — pin to `:v1` for safe auto-upgrades within the major version.

## What next

- **[Architecture](architecture.md)** — understand what you just deployed
- **[MCP reference](mcp-reference.md)** — browse the tools OpenClaw can call
- **[Troubleshooting](troubleshooting.md)** — if something above failed
- **[Backup & restore](backup-restore.md)** — don't skip this
- **[Deploy from source](DEPLOY.md)** — if you want to build your own image instead of using the prebuilt one
