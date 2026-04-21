#!/bin/sh
# Container entrypoint for mcp-dailyagent.
#
# 1. Wait for Postgres to accept connections (up to ~60s)
# 2. Run any pending Drizzle migrations
# 3. Seed the single profile row if SELF_HOSTED_USER_ID isn't in the DB yet
# 4. Exec `node server.js` (the Next.js standalone server)

set -e

log() {
  echo "[entrypoint] $*"
}

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SELF_HOSTED_USER_ID:?SELF_HOSTED_USER_ID is required}"
: "${MCP_API_KEY:?MCP_API_KEY is required}"

# --- 1. Wait for Postgres ---------------------------------------------------
log "waiting for database to accept connections..."
attempts=0
until node -e "
  const postgres = require('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 2, connect_timeout: 5 });
  sql\`SELECT 1\`.then(() => { sql.end(); process.exit(0); }).catch(() => process.exit(1));
" > /dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 30 ]; then
    log "ERROR: database still unreachable after ~60s. Is the postgres service up?"
    exit 1
  fi
  sleep 2
done
log "database reachable"

# --- 2. Run migrations ------------------------------------------------------
log "running drizzle migrations..."
node node_modules/drizzle-kit/bin.cjs migrate

# --- 3. Seed profile row ----------------------------------------------------
SEED_EMAIL="${SELF_HOSTED_USER_EMAIL:-user@localhost}"
log "ensuring profile row exists for user ${SELF_HOSTED_USER_ID} (${SEED_EMAIL})..."
node -e "
  const postgres = require('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const id = process.env.SELF_HOSTED_USER_ID;
  const email = process.env.SELF_HOSTED_USER_EMAIL || 'user@localhost';
  sql\`INSERT INTO profiles (id, email) VALUES (\${id}, \${email}) ON CONFLICT (id) DO NOTHING\`
    .then((result) => {
      console.log('[entrypoint] profile seed:', result.count === 1 ? 'inserted' : 'already present');
      return sql.end();
    })
    .catch((err) => {
      console.error('[entrypoint] profile seed failed:', err.message);
      sql.end();
      process.exit(1);
    });
"

# --- 4. Hand off to the app -------------------------------------------------
log "starting Next.js server..."
exec "$@"
