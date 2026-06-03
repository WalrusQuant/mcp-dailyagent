# Backup & restore

Your entire productivity life lives in this one Postgres database. Back it up.

## Automatic backups (on by default)

The default compose stack ships with a `db-backup` sidecar that runs nightly `pg_dump` with retention. Dumps land in `./backups` next to your `docker-compose.yml`:

```
backups/
├── daily/    last 14 days
├── weekly/   last 4 weeks
├── monthly/  last 6 months
└── last/     the most recent dump (overwritten each run)
```

Tune via `.env`:

| Var | Default | Notes |
|---|---|---|
| `BACKUP_SCHEDULE` | `@daily` | Cron (`0 3 * * *`) or shorthand (`@hourly`, `@every 1h`) |
| `BACKUP_KEEP_DAYS` | `14` | Daily backups to retain |
| `BACKUP_KEEP_WEEKS` | `4` | Weekly snapshots |
| `BACKUP_KEEP_MONTHS` | `6` | Monthly snapshots |

After changes: `docker compose up -d db-backup` to apply.

**Important:** the sidecar only protects you against DB-side data loss. **Copy `./backups` off the VPS regularly** — rsync, rclone, restic, whatever you trust. Local-only backups don't survive a stolen or dead VPS.

> **Ownership:** the backup image writes as root, so `./backups/` on the host will be root-owned. If you need to read dumps as a non-root user, `sudo chown -R you:you backups/` once after the first run, or replace the bind mount with a Docker-managed named volume.

To disable, comment out the `db-backup` service block in `docker-compose.yml`.

## What to back up

- **The Postgres volume** (`cadence_pgdata`) — all of your data
- **`.env`** — the secrets that make the app work. Regenerating loses access until you manually reset the MCP key in OpenClaw and the `SELF_HOSTED_USER_ID` has to match the profile row

That's it. The code is in git. Images are rebuilt from the Dockerfile. The only irreplaceable things are the DB volume and the `.env`.

## Quick backup: SQL dump

From the VPS:

```bash
docker compose exec -T postgres pg_dump -U cadence cadence | gzip > backup-$(date +%F).sql.gz
```

Produces something like `backup-2026-04-20.sql.gz`. Copy it off the VPS:

```bash
# From your laptop
scp you@vps:/path/to/cadence/backup-2026-04-20.sql.gz ./
```

Put it somewhere you trust. Tarsnap, a USB drive, an encrypted cloud backup — anywhere that isn't the same VPS.

## Restore from SQL dump

Fresh deploy, blank DB:

```bash
# On the VPS, after docker compose up -d postgres
gunzip -c backup-YYYY-MM-DD.sql.gz | docker compose exec -T postgres psql -U cadence cadence
```

Or from your laptop, piping over SSH:

```bash
gunzip -c backup-YYYY-MM-DD.sql.gz | ssh you@vps "cd /path/to/cadence && docker compose exec -T postgres psql -U cadence cadence"
```

### Important: the user ID must match

The DB is scoped by `SELF_HOSTED_USER_ID`. If you restore to a new deploy with a different `SELF_HOSTED_USER_ID`, **the dashboard won't see any of the data** even though the tables are full. The fix is to make `.env` match what's in the backup:

```bash
# Peek at the profile in the restored DB
docker compose exec postgres psql -U cadence -c "SELECT id FROM profiles"
```

Copy that UUID into `.env` as `SELF_HOSTED_USER_ID` and restart the app:

```bash
docker compose up -d --force-recreate app
```

## Manual cron-based backups (alternative)

If you disabled the `db-backup` sidecar (or run an older deploy that doesn't include it), you can replicate the same behavior with a host cron. Most users won't need this — the sidecar already runs nightly with retention.

Simple cron on the VPS, one per day, keeps 30 days locally:

```cron
# /etc/cron.d/cadence-backup
0 3 * * * root cd /opt/cadence && /usr/bin/docker compose exec -T postgres pg_dump -U cadence cadence | /bin/gzip > /var/backups/cadence/backup-$(date +\%F).sql.gz && find /var/backups/cadence -name "backup-*.sql.gz" -mtime +30 -delete
```

First make the directory and check it's writable:

```bash
sudo mkdir -p /var/backups/cadence
sudo chown root:root /var/backups/cadence
```

For off-site copies, layer rclone, rsync, or any backup tool you like on top of that directory.

## Volume-level backup (alternative)

If you'd rather snapshot the full volume (faster, larger, binary):

```bash
docker compose down
docker run --rm \
  -v cadence_cadence_pgdata:/data \
  -v "$(pwd)":/backup \
  alpine tar czf /backup/pgdata-$(date +%F).tar.gz -C /data .
docker compose up -d
```

Restore:

```bash
docker compose down
docker volume rm cadence_cadence_pgdata
docker volume create cadence_cadence_pgdata
docker run --rm \
  -v cadence_cadence_pgdata:/data \
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
  -e POSTGRES_USER=cadence -e POSTGRES_PASSWORD=x -e POSTGRES_DB=cadence \
  -p 55432:5432 postgres:16-alpine

# Wait until ready, then load the dump
gunzip -c backup-YYYY-MM-DD.sql.gz | docker exec -i pgverify psql -U cadence cadence

# Spot-check
docker exec -i pgverify psql -U cadence -c "SELECT COUNT(*) FROM tasks;"
docker exec -i pgverify psql -U cadence -c "SELECT id, email FROM profiles;"

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
