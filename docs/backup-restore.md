# Backup & restore

Your entire productivity life lives in this one Postgres database. Back it up.

## What to back up

- **The Postgres volume** (`dailyagent_pgdata`) — all of your data
- **`.env`** — the secrets that make the app work. Regenerating loses access until you manually reset the MCP key in OpenClaw and the `SELF_HOSTED_USER_ID` has to match the profile row

That's it. The code is in git. Images are rebuilt from the Dockerfile. The only irreplaceable things are the DB volume and the `.env`.

## Quick backup: SQL dump

From the VPS:

```bash
docker compose exec -T postgres pg_dump -U dailyagent dailyagent | gzip > backup-$(date +%F).sql.gz
```

Produces something like `backup-2026-04-20.sql.gz`. Copy it off the VPS:

```bash
# From your laptop
scp you@vps:/path/to/mcp-dailyagent/backup-2026-04-20.sql.gz ./
```

Put it somewhere you trust. Tarsnap, a USB drive, an encrypted cloud backup — anywhere that isn't the same VPS.

## Restore from SQL dump

Fresh deploy, blank DB:

```bash
# On the VPS, after docker compose up -d postgres
gunzip -c backup-YYYY-MM-DD.sql.gz | docker compose exec -T postgres psql -U dailyagent dailyagent
```

Or from your laptop, piping over SSH:

```bash
gunzip -c backup-YYYY-MM-DD.sql.gz | ssh you@vps "cd /path/to/mcp-dailyagent && docker compose exec -T postgres psql -U dailyagent dailyagent"
```

### Important: the user ID must match

The DB is scoped by `SELF_HOSTED_USER_ID`. If you restore to a new deploy with a different `SELF_HOSTED_USER_ID`, **the dashboard won't see any of the data** even though the tables are full. The fix is to make `.env` match what's in the backup:

```bash
# Peek at the profile in the restored DB
docker compose exec postgres psql -U dailyagent -c "SELECT id FROM profiles"
```

Copy that UUID into `.env` as `SELF_HOSTED_USER_ID` and restart the app:

```bash
docker compose up -d --force-recreate app
```

## Scheduled backups

Simple cron on the VPS, one per day, keeps 30 days locally:

```cron
# /etc/cron.d/dailyagent-backup
0 3 * * * root cd /opt/mcp-dailyagent && /usr/bin/docker compose exec -T postgres pg_dump -U dailyagent dailyagent | /bin/gzip > /var/backups/dailyagent/backup-$(date +\%F).sql.gz && find /var/backups/dailyagent -name "backup-*.sql.gz" -mtime +30 -delete
```

First make the directory and check it's writable:

```bash
sudo mkdir -p /var/backups/dailyagent
sudo chown root:root /var/backups/dailyagent
```

For off-site copies, layer rclone, rsync, or any backup tool you like on top of that directory.

## Volume-level backup (alternative)

If you'd rather snapshot the full volume (faster, larger, binary):

```bash
docker compose down
docker run --rm \
  -v mcp-dailyagent_dailyagent_pgdata:/data \
  -v "$(pwd)":/backup \
  alpine tar czf /backup/pgdata-$(date +%F).tar.gz -C /data .
docker compose up -d
```

Restore:

```bash
docker compose down
docker volume rm mcp-dailyagent_dailyagent_pgdata
docker volume create mcp-dailyagent_dailyagent_pgdata
docker run --rm \
  -v mcp-dailyagent_dailyagent_pgdata:/data \
  -v "$(pwd)":/backup \
  alpine sh -c "cd /data && tar xzf /backup/pgdata-YYYY-MM-DD.tar.gz"
docker compose up -d
```

Volume-level backups are handy but brittle — they break if the Postgres minor version changes, and they require stopping the DB. SQL dumps are almost always the better choice unless the DB is huge.

## Verifying a backup

Don't trust a backup you haven't restored at least once. Quickest dry run:

```bash
# Spin up a throwaway Postgres with the dump
docker run --rm -d --name pgverify \
  -e POSTGRES_USER=dailyagent -e POSTGRES_PASSWORD=x -e POSTGRES_DB=dailyagent \
  -p 55432:5432 postgres:16-alpine

# Wait until ready, then load the dump
gunzip -c backup-YYYY-MM-DD.sql.gz | docker exec -i pgverify psql -U dailyagent dailyagent

# Spot-check
docker exec -i pgverify psql -U dailyagent -c "SELECT COUNT(*) FROM tasks;"
docker exec -i pgverify psql -U dailyagent -c "SELECT id, email FROM profiles;"

# Tear down
docker stop pgverify
```

If the counts match what you expect, the backup is live.

## Wiping data (not backing up — destroying)

If you want to nuke productivity data while keeping the schema and profile, use the **Danger Zone → Wipe All Data** button in Settings. It preserves the `profiles` row. Or directly:

```sql
TRUNCATE
  tasks, habits, habit_logs, journal_entries,
  workout_templates, workout_exercises, workout_logs, workout_log_exercises,
  focus_sessions, goals, goal_progress_logs,
  spaces, tags, weekly_reviews, daily_briefings, insight_cache
CASCADE;
```

To completely reset (schema and all), see [local-development.md#resetting-the-db](local-development.md#resetting-the-db).
