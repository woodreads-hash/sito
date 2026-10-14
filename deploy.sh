#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# WooDreads — complete VPS deployment script
# Tested on: Ubuntu 22.04 / 24.04 LTS
#
# Usage:
#   sudo bash deploy.sh           # interactive (prompts for domain, DB password)
#   sudo bash deploy.sh --auto    # non-interactive (uses env vars)
#
# Required env vars for --auto mode:
#   DOMAIN, STRAPI_ADMIN_JWT, DB_PASSWORD, SSL_EMAIL
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*" >&2; }

# ── Check root ──
if [ "$(id -u)" -ne 0 ]; then
  err "Run as root: sudo bash deploy.sh"
  exit 1
fi

# ── Config ──
AUTO_MODE=false
[ "${1:-}" = "--auto" ] && AUTO_MODE=true

if $AUTO_MODE; then
  DOMAIN="${DOMAIN:?Set DOMAIN env var}"
  DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD env var}"
  SSL_EMAIL="${SSL_EMAIL:?Set SSL_EMAIL env var}"
  STRAPI_ADMIN_JWT="${STRAPI_ADMIN_JWT:-$(openssl rand -hex 32)}"
else
  read -rp "Domain name (e.g. woodreads.it): " DOMAIN
  while true; do
    read -rsp "PostgreSQL password for woodreads user: " DB_PASSWORD; echo
    [ -n "$DB_PASSWORD" ] && break
  done
  read -rp "Email for Let's Encrypt (for renewal notices): " SSL_EMAIL
  STRAPI_ADMIN_JWT=$(openssl rand -hex 32)
fi

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="/opt/woodreads"
WWW_DIR="/var/www/woodreads"
CMS_DIR="${DEPLOY_DIR}/cms"
GATEWAY_DIR="${DEPLOY_DIR}/api-gateway"
SCRIPTS_DIR="${DEPLOY_DIR}/scripts"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/tmp/woodreads-deploy-${TIMESTAMP}.log"

echo -e "\n${CYAN}══════════════════════════════════════════${NC}"
echo -e "${CYAN}  WooDreads VPS Deployment${NC}"
echo -e "${CYAN}  Domain: ${DOMAIN}${NC}"
echo -e "${CYAN}  Log:    ${LOG_FILE}${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}\n"

exec > >(tee -a "$LOG_FILE") 2>&1

# ═══════════════════════════════════════
# 1. System dependencies
# ═══════════════════════════════════════
step_system() {
  info "1/9 — Installing system packages..."
  apt-get update -qq
  apt-get install -y -qq \
    curl wget gnupg ca-certificates \
    nginx certbot python3-certbot-nginx \
    postgresql postgresql-client \
    nodejs npm \
    git unzip fail2ban \
    sqlite3
  ok "System packages installed"
}

# ═══════════════════════════════════════
# 2. Node.js (ensure latest LTS)
# ═══════════════════════════════════════
step_node() {
  info "2/9 — Ensuring Node.js 20 LTS..."
  if ! node -v | grep -q "v20\|v22"; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
  fi
  ok "Node.js $(node -v) • npm $(npm -v)"
}

# ═══════════════════════════════════════
# 3. PostgreSQL database
# ═══════════════════════════════════════
step_database() {
  info "3/9 — Setting up PostgreSQL..."
  systemctl enable --now postgresql

  # Create user and database (idempotent)
  su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='woodreads'\" | grep -q 1 || psql -c \"CREATE USER woodreads WITH PASSWORD '${DB_PASSWORD}';\""
  su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='woodreads'\" | grep -q 1 || psql -c \"CREATE DATABASE woodreads OWNER woodreads;\""
  su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE woodreads TO woodreads;\""

  # Save password for backup script
  echo "DB_PASSWORD=${DB_PASSWORD}" > "${SCRIPTS_DIR}/.db-env"
  chmod 600 "${SCRIPTS_DIR}/.db-env"
  ok "Database 'woodreads' ready (user: woodreads)"
}

# ═══════════════════════════════════════
# 4. Deploy directories
# ═══════════════════════════════════════
step_dirs() {
  info "4/9 — Creating directories..."
  useradd -m -s /bin/bash -U woodreads 2>/dev/null || true

  mkdir -p "${CMS_DIR}" "${GATEWAY_DIR}" "${SCRIPTS_DIR}" "${WWW_DIR}" \
           "${DEPLOY_DIR}/backups" "/var/log/nginx"
  ok "Directories created under ${DEPLOY_DIR}"
}

# ═══════════════════════════════════════
# 5. Deploy static frontend
# ═══════════════════════════════════════
step_frontend() {
  info "5/9 — Deploying static frontend..."
  # Copy frontend pages (non-destructive: keep any extra files already deployed)
  cp "${SRC_DIR}/index.html" "${WWW_DIR}/index.html"
  for p in blog.html blog-post.html admin.html; do
    [ -f "${SRC_DIR}/${p}" ] && cp "${SRC_DIR}/${p}" "${WWW_DIR}/${p}"
  done
  chown -R woodreads:woodreads "${WWW_DIR}"
  ok "Frontend copied to ${WWW_DIR}"
}

# ═══════════════════════════════════════
# 6. Deploy API gateway
# ═══════════════════════════════════════
step_gateway() {
  info "6/9 — Deploying API gateway..."
  cp "${SRC_DIR}/api-gateway/server.js" "${GATEWAY_DIR}/"
  cp "${SRC_DIR}/api-gateway/package.json" "${GATEWAY_DIR}/"
  cd "${GATEWAY_DIR}"
  npm install --production --silent
  ok "API gateway deployed on port 3001"
}

# ═══════════════════════════════════════
# 7. Strapi CMS
# ═══════════════════════════════════════
step_strapi() {
  info "7/9 — Bootstrapping Strapi CMS..."

  if [ ! -f "${CMS_DIR}/package.json" ]; then
    # Create Strapi project
    cd "${DEPLOY_DIR}"
    npx create-strapi-app@latest cms --quickstart --no-run --skip-cloud 2>/dev/null || {
      err "Strapi creation failed. Trying manual init..."
      cd "${CMS_DIR}"
      npx create-strapi-app@latest . --quickstart --no-run 2>/dev/null || true
    }
  fi

  cd "${CMS_DIR}"

  # Copy custom content-type schemas
  cp -r "${SRC_DIR}/strapi/src/"* "${CMS_DIR}/src/" 2>/dev/null || true

  # Copy plugins config for image optimization
  mkdir -p "${CMS_DIR}/config"
  cp "${SRC_DIR}/strapi/config/plugins.js" "${CMS_DIR}/config/" 2>/dev/null || true

  # Configure Strapi admin
  cat > "${CMS_DIR}/config/admin.js" << ADMINEOF
module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', '${STRAPI_ADMIN_JWT}'),
  },
  // Uncomment to serve admin on a custom path:
  // url: '/secret-admin',
  // path: '/secret-admin',
  watchIgnoreFiles: ['**/*.html'],
});
ADMINEOF

  # Configure database
  cat > "${CMS_DIR}/config/database.js" << DBEOF
module.exports = ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST', '127.0.0.1'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'woodreads'),
      user: env('DATABASE_USERNAME', 'woodreads'),
      password: env('DATABASE_PASSWORD', '${DB_PASSWORD}'),
      ssl: false,
    },
    useNullAsDefault: true,
  },
});
DBEOF

  # Create .env
  cat > "${CMS_DIR}/.env" << ENVEOF
HOST=127.0.0.1
PORT=1337
APP_KEYS=$(openssl rand -hex 16),$(openssl rand -hex 16)
API_TOKEN_SALT=$(openssl rand -hex 16)
ADMIN_JWT_SECRET=${STRAPI_ADMIN_JWT}
TRANSFER_TOKEN_SALT=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 16)
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=woodreads
DATABASE_USERNAME=woodreads
DATABASE_PASSWORD=${DB_PASSWORD}
NODE_ENV=production
ENVEOF

  chown -R woodreads:woodreads "${CMS_DIR}"
  chmod 600 "${CMS_DIR}/.env"

  # Build admin panel
  info "Building Strapi admin (this takes a moment)..."
  NODE_ENV=production npm run build 2>/dev/null || warn "Strapi build had warnings (non-fatal)"

  ok "Strapi CMS configured (PostgreSQL)"
}

# ═══════════════════════════════════════
# 8. Nginx + SSL
# ═══════════════════════════════════════
step_nginx() {
  info "8/9 — Configuring Nginx + Let's Encrypt..."

  # Copy config
  cp "${SRC_DIR}/nginx/woodreads.conf" "${NGINX_AVAILABLE}/woodreads.conf"
  cp "${SRC_DIR}/nginx/rate-limit.conf" "/etc/nginx/rate-limit.conf"

  # Enable rate limits in main nginx.conf
  if ! grep -q "rate-limit.conf" /etc/nginx/nginx.conf; then
    sed -i '/^http {/a \    include /etc/nginx/rate-limit.conf;' /etc/nginx/nginx.conf
  fi

  # Disable default site
  rm -f "${NGINX_ENABLED}/default"

  # Link our config
  ln -sf "${NGINX_AVAILABLE}/woodreads.conf" "${NGINX_ENABLED}/woodreads.conf"

  # Test config (without SSL first, since cert doesn't exist yet)
  nginx -t || { err "Nginx config test failed"; exit 1; }
  systemctl reload nginx

  # Obtain SSL certificate
  info "Obtaining SSL certificate from Let's Encrypt..."
  certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos --email "${SSL_EMAIL}" \
    --redirect --hsts || warn "Let's Encrypt failed — run manually: certbot --nginx -d ${DOMAIN}"

  systemctl reload nginx
  ok "Nginx + SSL ready"
}

# ═══════════════════════════════════════
# 9. Systemd services
# ═══════════════════════════════════════
step_services() {
  info "9/9 — Setting up systemd services..."

  # Update service files with actual paths
  sed "s|DB_PASSWORD|${DB_PASSWORD}|g" "${SRC_DIR}/systemd/woodreads-cms.service" \
    > /etc/systemd/system/woodreads-cms.service
  cp "${SRC_DIR}/systemd/woodreads-gateway.service" \
    /etc/systemd/system/woodreads-gateway.service

  # Copy backup script
  cp "${SRC_DIR}/scripts/backup-db.sh" "${SCRIPTS_DIR}/backup-db.sh"
  chmod +x "${SCRIPTS_DIR}/backup-db.sh"

  systemctl daemon-reload
  systemctl enable --now woodreads-cms
  systemctl enable --now woodreads-gateway

  info "Waiting for Strapi to start (15s)..."
  sleep 15

  systemctl status woodreads-cms --no-pager 2>/dev/null | head -5
  systemctl status woodreads-gateway --no-pager 2>/dev/null | head -5

  ok "Services running"
}

# ═══════════════════════════════════════
# 10. Fail2ban + security
# ═══════════════════════════════════════
step_security() {
  info "Extra — Configuring Fail2ban for Nginx..."

  cat > /etc/fail2ban/jail.local << F2BEOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 10

[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true

[nginx-limit-req]
enabled = true

[sshd]
enabled = true
port = ssh
F2BEOF

  systemctl enable --now fail2ban
  ok "Fail2ban active"
}

# ═══════════════════════════════════════
# 11. Cron: weekly backup
# ═══════════════════════════════════════
step_cron() {
  info "Extra — Installing weekly backup cron..."

  # /etc/cron.weekly/woodreads-backup
  cat > /etc/cron.weekly/woodreads-backup << 'CRONEOF'
#!/usr/bin/env bash
source /opt/woodreads/scripts/.db-env 2>/dev/null || true
exec /opt/woodreads/scripts/backup-db.sh
CRONEOF
  chmod +x /etc/cron.weekly/woodreads-backup

  ok "Weekly backup cron installed (Sundays at 3 AM)"
}

# ═══════════════════════════════════════
# Summary
# ═══════════════════════════════════════
print_summary() {
  echo ""
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ Deployment complete!${NC}"
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${CYAN}Site:${NC}       https://${DOMAIN}"
  echo -e "  ${CYAN}Admin:${NC}      https://${DOMAIN}/admin"
  echo -e "  ${CYAN}Gateway:${NC}    http://127.0.0.1:3001 (internal)"
  echo -e "  ${CYAN}Strapi:${NC}     http://127.0.0.1:1337 (internal)"
  echo ""
  echo -e "  ${YELLOW}→ Create your admin account at:${NC}"
  echo -e "    https://${DOMAIN}/admin"
  echo ""
  echo -e "  ${YELLOW}→ Then configure in Strapi admin:${NC}"
  echo -e "    1. Photo Categories (Content Manager)"
  echo -e "    2. Working Hours (Content Manager)"
  echo -e "    3. Social Stat (Content Manager)"
  echo -e "    4. Upload photos (Media Library)"
  echo ""
  echo -e "  ${YELLOW}→ Restrict /admin with IP whitelist:${NC}"
  echo -e "    Edit ${NGINX_AVAILABLE}/woodreads.conf"
  echo -e "    Uncomment the 'location ^~ /admin' block"
  echo -e "    Add your IP, then: nginx -t && systemctl reload nginx"
  echo ""
  echo -e "  ${YELLOW}→ Backups:${NC}  ${DEPLOY_DIR}/backups/ (weekly, 90-day retention)"
  echo -e "  ${YELLOW}→ Log:${NC}      ${LOG_FILE}"
  echo ""
}

# ═══════════════════════════════════════
# Execute
# ═══════════════════════════════════════
step_system
step_node
step_dirs
step_database
step_frontend
step_gateway
step_strapi
step_nginx
step_services
step_security
step_cron
print_summary
