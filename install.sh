#!/usr/bin/env bash
#
# PasteClean — one-command installer.
#
# Installs PasteClean on a Linux server with:
#   - Node.js app (static files + X-Ray redirect resolver API) under systemd
#   - Nginx reverse proxy with caching and security headers
#
# Usage:
#   bash install.sh                       # defaults: domain _, port 8080
#   bash install.sh example.com 8080       # custom domain + public port
#   PORT=8080 INTERNAL_PORT=8180 bash install.sh
#
# Re-run safely — it updates an existing installation.
#
set -euo pipefail

# ---- defaults ---------------------------------------------------------------
REPO_URL="${REPO_URL:-https://github.com/ragar7design-wq/paste-clean.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/paste-clean}"
DOMAIN="${1:-_}"                 # "_" means serve on any host / IP
PUBLIC_PORT="${2:-${PORT:-8080}}"
INTERNAL_PORT="${INTERNAL_PORT:-$((PUBLIC_PORT + 1000))}"
SERVICE_NAME="paste-clean"

# ---- helpers ---------------------------------------------------------------
c_ok()   { printf "\033[1;32m==> %s\033[0m\n" "$*"; }
c_step() { printf "\033[1;36m--> %s\033[0m\n" "$*"; }
c_err()  { printf "\033[1;31m!! %s\033[0m\n" "$*" >&2; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    c_err "This installer needs root. Re-run with: sudo bash install.sh $*"
    exit 1
  fi
}

detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then echo apt
  elif command -v dnf >/dev/null 2>&1; then echo dnf
  elif command -v yum >/dev/null 2>&1; then echo yum
  elif command -v apk >/dev/null 2>&1; then echo apk
  else echo none; fi
}

install_packages() {
  local pm; pm="$(detect_pkg_manager)"
  c_step "Installing system packages via $pm…"
  case "$pm" in
    apt) apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y git nginx curl ;;
    dnf) dnf install -y git nginx curl ;;
    yum) yum install -y git nginx curl ;;
    apk) apk add --no-cache git nginx curl ;;
    *) c_err "No supported package manager found. Install git, nginx, curl manually."; exit 1 ;;
  esac
}

ensure_node() {
  if command -v node >/dev/null 2>&1 && node -v >/dev/null 2>&1; then
    c_step "Node.js $(node -v) already installed."
    return
  fi
  c_step "Node.js not found — installing NodeSource Node 20…"
  if [ ! -f /etc/apt/keyrings/nodesource.gpg ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  fi
  local pm; pm="$(detect_pkg_manager)"
  case "$pm" in
    apt) DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs ;;
    *) c_err "Auto Node install only supports apt-based systems. Install Node.js 20+ manually."; exit 1 ;;
  esac
}

clone_or_update() {
  c_step "Deploying code to $INSTALL_DIR…"
  if [ -d "$INSTALL_DIR/.git" ]; then
    git -C "$INSTALL_DIR" fetch --all
    git -C "$INSTALL_DIR" reset --hard origin/main
  else
    rm -rf "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
}

build_static() {
  c_step "Building static assets…"
  ( cd "$INSTALL_DIR" && npm install --silent && node scripts/build.mjs )
}

write_systemd_unit() {
  c_step "Writing systemd unit: $SERVICE_NAME.service…"
  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<UNIT
[Unit]
Description=PasteClean web app + X-Ray redirect API
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
Environment=PORT=$INTERNAL_PORT
Environment=NODE_ENV=production
ExecStart=$(command -v node) $INSTALL_DIR/scripts/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
}

write_nginx_site() {
  c_step "Writing Nginx site (domain=$DOMAIN, public port=$PUBLIC_PORT)…"
  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null || true
  sed -e "s|{{DOMAIN}}|$DOMAIN|g" \
      -e "s|{{PUBLIC_PORT}}|$PUBLIC_PORT|g" \
      -e "s|{{INTERNAL_PORT}}|$INTERNAL_PORT|g" \
      -e "s|{{INSTALL_DIR}}|$INSTALL_DIR|g" \
      "$INSTALL_DIR/deploy/nginx.conf" > "/etc/nginx/sites-available/${SERVICE_NAME}"

  # Enable site (disable default only on Debian-like layout)
  ln -sf "/etc/nginx/sites-available/${SERVICE_NAME}" "/etc/nginx/sites-enabled/${SERVICE_NAME}"
  if [ -f /etc/nginx/sites-enabled/default ] && [ "$DOMAIN" = "_" ]; then
    rm -f /etc/nginx/sites-enabled/default || true
  fi
  nginx -t
  systemctl reload nginx || systemctl restart nginx
}

print_result() {
  local host; host="${DOMAIN/_/$(hostname -I 2>/dev/null | awk '{print $1}')}"
  c_ok "PasteClean installed successfully!"
  echo
  echo "  App directory : $INSTALL_DIR"
  echo "  systemd unit  : $SERVICE_NAME.service  (port $INTERNAL_PORT, internal)"
  echo "  Nginx site    : /etc/nginx/sites-available/$SERVICE_NAME  (port $PUBLIC_PORT, public)"
  echo "  Public URL    : http://${host}:${PUBLIC_PORT}"
  echo
  echo "  Manage:"
  echo "    sudo systemctl restart $SERVICE_NAME   # restart app/API"
  echo "    sudo systemctl reload  nginx           # reload Nginx"
  echo "    sudo journalctl -u $SERVICE_NAME -f    # app logs"
  echo
  if [ "$DOMAIN" = "_" ]; then
    echo "  Tip: pass your domain — 'sudo bash install.sh your.domain $PUBLIC_PORT'"
    echo "       then add TLS with: sudo certbot --nginx -d your.domain"
  fi
}

# ---- main ------------------------------------------------------------------
require_root "$@"
install_packages
ensure_node
clone_or_update
build_static
write_systemd_unit
write_nginx_site
print_result