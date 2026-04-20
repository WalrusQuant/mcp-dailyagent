# Troubleshooting

When something breaks, start here. Most failures fall into one of a handful of buckets.

## MCP server

### `401 Unauthorized` from `/api/mcp`

The bearer token OpenClaw is sending doesn't match `MCP_API_KEY` in the app's `.env`.

Check:

```bash
# On the VPS
docker compose exec app printenv MCP_API_KEY
```

Compare to the `Authorization: Bearer ...` OpenClaw is sending. A common cause is a trailing newline when the token was copy-pasted with `echo`. Regenerate cleanly:

```bash
openssl rand -hex 32
```

Paste that into both `.env` and the OpenClaw MCP config.

### `ECONNREFUSED` / `connection refused` from OpenClaw

The agent can't reach the VPS on port 3000 via the hostname it was given.

Check, **from the OpenClaw host**:

```bash
curl -v http://<vps-hostname>:3000/api/mcp
```

Common causes:

- The hostname resolves to `127.0.1.1` or localhost. Fix: use the VPS's **Tailscale IPv4 address** (like `100.x.y.z`) or its magic-DNS name, not its system hostname.
- Port 3000 is blocked by the VPS firewall *and* you're not on the tailnet. Fix: connect to Tailscale first.
- The app container is bound to `127.0.0.1:3000` (it is, by default) and you're trying to reach it from the public interface. Fix: use Tailscale — that's the whole point.

### `curl` works but the agent says "not connected"

The MCP config in OpenClaw is wrong. Verify:

```bash
openclaw mcp show dailyagent
```

The URL, headers, and transport (`streamable-http`) must match what you wrote in `.env`. After any edit, restart the OpenClaw gateway:

```bash
systemctl restart openclaw-gateway   # or whatever your install uses
```

### Tool returned a schema error

If a tool argument is rejected before hitting the DB, the error names the field. Common ones:

| Error | Likely cause |
|---|---|
| `priority: Must be A1-C9 ...` | You sent `"A"` — use `A1`, `B3`, `C9`, etc. See [MCP reference](mcp-reference.md#shared-value-formats). |
| `task_date: Must be YYYY-MM-DD format` | Sent a relative date like `"tomorrow"` — parse it to `YYYY-MM-DD` before calling. |
| `status: Invalid enum value` | Goal/space status restricted to a fixed set. `paused` is valid for spaces, not goals. `archived` is not valid anywhere. |
| `frequency: Invalid enum value` | Habits are `daily` or `weekly` only. There's no `custom`. |
| `category: Invalid enum value` | Goal categories: `health`, `career`, `personal`, `financial`, `learning`, `relationships`, `other`. |

### Tool returned a Postgres CHECK constraint error

If you see a raw Postgres error like `new row for relation "tasks" violates check constraint "tasks_priority_check"`, the Zod schema and the DB `CHECK` are out of sync. That shouldn't happen with current `src/lib/mcp/tools/validators.ts`, but if it does, file a bug.

## App container

### `SELF_HOSTED_USER_ID is not set`

The app container didn't pick up `.env`. Check:

```bash
docker compose config | grep SELF_HOSTED_USER_ID
```

If it's empty, your `.env` file isn't named exactly `.env` (not `.env.local`) in the same directory as `docker-compose.yml`, or compose was started from a different directory.

### `DATABASE_URL is not set`

Same fix as above. Also confirm the `postgres` service is up:

```bash
docker compose ps postgres   # STATUS should say "healthy"
```

### App crashes on boot with `password authentication failed`

The password in `DATABASE_URL` doesn't match `POSTGRES_PASSWORD`. They have to match — the former is what the app connects with, the latter is what the Postgres container initialized.

Fix: align them in `.env`, then recreate Postgres to pick up the new password:

```bash
docker compose down
docker volume rm mcp-dailyagent_dailyagent_pgdata   # ⚠️ wipes DB data
docker compose up -d postgres
docker compose run --rm app node node_modules/drizzle-kit/bin.cjs migrate
# re-seed the profile row
```

Only do the volume wipe if there's no data you care about yet.

## Port conflicts

### Port 3000 already in use

Another service (gotenberg, grafana, whatever) is bound to 3000 on the VPS. Two options:

- **Stop the conflicting service** if you don't need it: `docker ps` to find it, `docker stop <name>`.
- **Remap the app port**. In `docker-compose.yml`, change the app's ports line:

  ```yaml
  ports:
    - "127.0.0.1:3100:3000"
  ```

  Then update the OpenClaw MCP config to `http://<host>:3100/api/mcp` and rebuild: `docker compose up -d --build app`.

### Postgres port 5432 already in use

Similar fix. The Postgres port only matters if you want to connect from the host (e.g. Drizzle Studio against prod). Most of the time, you can just remove the `ports:` mapping from the `postgres` service entirely — the app reaches Postgres over the Docker network regardless.

## Migrations

### `drizzle-kit migrate` fails with `relation ... already exists`

You've run migrations against a DB that already has the schema applied manually (or by a previous migration that wasn't tracked). The fix depends on which side is truthful. Easiest recovery:

```bash
docker compose exec postgres psql -U dailyagent -d dailyagent -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose run --rm app node node_modules/drizzle-kit/bin.cjs migrate
```

⚠️ That wipes all data. Only do it on a fresh deploy. On an established deploy, contact a real human (hi 👋) before destroying schemas.

### `drizzle-kit migrate` says "no migrations to apply" but the tables aren't there

The migration files aren't baked into the image. Rebuild:

```bash
docker compose build app
docker compose run --rm app node node_modules/drizzle-kit/bin.cjs migrate
```

## Dashboard

### `/dashboard` returns 500 with `DATABASE_URL is not set`

The app is running but can't reach Postgres. See the *App container* section above.

### Dashboard shows no data after wiping

The `profiles` row got deleted along with everything else. Re-seed it:

```bash
source .env
docker compose exec -T postgres psql -U dailyagent -d dailyagent <<EOF
INSERT INTO profiles (id, email, display_name, is_admin)
VALUES ('$SELF_HOSTED_USER_ID', 'you@example.com', 'You', true)
ON CONFLICT (id) DO NOTHING;
EOF
```

The Danger Zone wipe button preserves the profile, but manual `TRUNCATE` might not — always keep the `profiles` row.

## Tailscale

### Dashboard unreachable from laptop

Check, on the laptop:

```bash
tailscale status
tailscale ping <vps-hostname>
```

If `tailscale status` shows the VPS but ping fails, subnet routing or ACLs may be blocking. Check the Tailscale admin console → Access controls. For a simple single-user setup, the default ACL (allow all) is fine.

If `tailscale status` doesn't list the VPS at all, run `sudo tailscale up` on the VPS again and follow the auth link.

### Browser loads `http://vps:3000` but never completes

Magic DNS might be off. Either turn it on in Tailscale admin, or use the raw tailnet IPv4 (`http://100.x.y.z:3000`).

## Where to look when none of the above fit

- App logs: `docker compose logs -f app`. Next.js in production only logs errors — empty is normal for working state.
- Postgres logs: `docker compose logs -f postgres`.
- Direct MCP test with `curl` (see the end of the [quick start](quick-start.md)) — rules out whether the agent layer is the problem.
- `docker compose config` — prints the resolved compose file with all env vars substituted. Sanity-check what's actually getting set.
