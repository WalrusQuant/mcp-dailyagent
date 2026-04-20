# Quick start

This is the five-minute happy path. For the full walkthrough (firewall rules, Tailscale config, troubleshooting, etc.), see the [VPS walkthrough](DEPLOY.md).

## Prerequisites

- A VPS with **Docker Engine + Docker Compose v2** installed
- **git**
- **Tailscale** installed on the VPS *and* on the device you'll browse from
- An OpenClaw install somewhere (your laptop, another VPS, doesn't matter)

You do **not** need Node.js on the VPS. Everything runs in containers.

## 1. Clone

```bash
git clone https://github.com/WalrusQuant/mcp-dailyagent.git
cd mcp-dailyagent
```

## 2. Write `.env`

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

Then edit `.env` so `POSTGRES_PASSWORD` matches the password in `DATABASE_URL`. Back the whole file up somewhere safe — it contains every secret.

## 3. Start Postgres, run migrations, seed the single user

```bash
docker compose up -d postgres
docker compose run --rm app node node_modules/drizzle-kit/bin.cjs migrate

source .env
docker compose exec -T postgres psql -U dailyagent -d dailyagent <<EOF
INSERT INTO profiles (id, email, display_name, is_admin)
VALUES ('$SELF_HOSTED_USER_ID', 'you@example.com', 'You', true)
ON CONFLICT (id) DO NOTHING;
EOF
```

## 4. Build + start the app

```bash
docker compose up -d --build app
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard
# → 200
```

## 5. Tailscale + firewall

```bash
sudo tailscale up        # follow the auth link
sudo ufw deny 3000/tcp   # or whatever firewall you use
```

The compose file binds Postgres and the app to `127.0.0.1` by default, so neither is reachable from outside the VPS. Tailscale's WireGuard interface is what lets your tailnet devices in.

## 6. Hook OpenClaw up

Point OpenClaw at `http://<vps-tailnet-name>:3000/api/mcp` with `Authorization: Bearer <MCP_API_KEY>`. Drop the [skill file](openclaw-skill.md) into OpenClaw's skills directory so the agent knows what tools are available.

Verify from another tailnet device:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}' \
  http://<vps-tailnet-name>:3000/api/mcp
```

A JSON-RPC response listing server capabilities means it's working.

## You're done

Visit `http://<vps-tailnet-name>:3000` from any Tailscale-connected device. Ask OpenClaw to "create a task called verify mcp write path" — if it returns without an error, your agent can write to the DB.

## What next

- **[Architecture](architecture.md)** — understand what you just deployed
- **[MCP reference](mcp-reference.md)** — browse the tools OpenClaw can call
- **[Troubleshooting](troubleshooting.md)** — if something above failed
- **[Backup & restore](backup-restore.md)** — don't skip this
