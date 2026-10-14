#!/usr/bin/env bash
# WooDreads — Automated weekly database backup
# Run via cron:  0 3 * * 0 /opt/woodreads/scripts/backup-db.sh
#
# Supports: PostgreSQL | SQLite (Strapi default)
# Configure BACKUP_TYPE below to match your Strapi database.

set -euo pipefail

# ── Config ──
BACKUP_TYPE="postgres"                    # "postgres" or "sqlite"
BACKUP_DIR="/opt/woodreads/backups"
DB_NAME="woodreads"
DB_USER="woodreads"
DB_HOST="localhost"
DB_PORT="5432"
PG_DUMP="/usr/bin/pg_dump"               # PostgreSQL
SQLITE_PATH="/opt/woodreads/cms/.tmp/data.db"  # SQLite
RETENTION_DAYS=90                         # Keep backups 3 months
SLACK_WEBHOOK=""                          # Optional: https://hooks.slack.com/...

# ── Timestamp ──
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
FILENAME="woodreads-${TIMESTAMP}"
mkdir -p "${BACKUP_DIR}"

# ── Backup ──
case "${BACKUP_TYPE}" in
  postgres)
    PGPASSWORD="${DB_PASSWORD}" "${PG_DUMP}" \
      -h "${DB_HOST}" -p "${DB_PORT}" \
      -U "${DB_USER}" -d "${DB_NAME}" \
      --no-owner --no-acl \
      -F c -f "${BACKUP_DIR}/${FILENAME}.dump"
    echo "pg_dump → ${FILENAME}.dump"
    ;;
  sqlite)
    if [ -f "${SQLITE_PATH}" ]; then
      cp "${SQLITE_PATH}" "${BACKUP_DIR}/${FILENAME}.db"
      sqlite3 "${SQLITE_PATH}" ".backup '${BACKUP_DIR}/${FILENAME}.db'" 2>/dev/null || true
      echo "sqlite → ${FILENAME}.db"
    else
      echo "WARNING: SQLite DB not found at ${SQLITE_PATH}"
    fi
    ;;
  *)
    echo "ERROR: BACKUP_TYPE must be 'postgres' or 'sqlite'"
    exit 1
    ;;
esac

# ── Compress ──
gzip -f "${BACKUP_DIR}/${FILENAME}.${BACKUP_TYPE:0:4}"*
echo "Compressed: ${FILENAME}"

# ── Retention: remove files older than N days ──
find "${BACKUP_DIR}" -name "woodreads-*" -type f -mtime "+${RETENTION_DAYS}" -delete
echo "Cleaned backups older than ${RETENTION_DAYS} days"

# ── Test backup integrity ──
echo "Backup size: $(du -sh "${BACKUP_DIR}/${FILENAME}"* | cut -f1)"

# ── Optional: notify via Slack ──
if [ -n "${SLACK_WEBHOOK}" ]; then
  curl -s -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"✅ WooDreads backup completato: ${FILENAME}\"}" \
    "${SLACK_WEBHOOK}" > /dev/null
fi

echo "✅ Backup done: ${FILENAME}"
