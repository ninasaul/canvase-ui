#!/usr/bin/env bash
# Runs on the VPS after rsync. Args come from the local deploy script via env.
set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:?}"
APP_PORT="${APP_PORT:?}"
DOMAIN="${DOMAIN:?}"
PNPM_VERSION="${PNPM_VERSION:?}"
CADDY_BEGIN="${CADDY_BEGIN:?}"
CADDY_END="${CADDY_END:?}"

cd "$REMOTE_DIR"
[[ -f .env ]] || { echo "missing ${REMOTE_DIR}/.env" >&2; exit 1; }

set -a
# shellcheck disable=SC1091
source .env
set +a

[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL missing in .env" >&2; exit 1; }

read -r db_user db_pass db_name db_host < <(
  python3 - <<'PY'
from urllib.parse import urlparse, unquote
import os
u = urlparse(os.environ["DATABASE_URL"])
user = unquote(u.username or "")
password = unquote(u.password or "")
name = unquote((u.path or "/").lstrip("/").split("?")[0].split("/")[0])
host = u.hostname or "127.0.0.1"
# single-line, NUL-safe enough for our credentials
print(user, password, name, host)
PY
)

[[ -n "$db_user" && -n "$db_name" ]] || { echo "failed to parse DATABASE_URL" >&2; exit 1; }

echo "[remote] ensure postgres role/db: ${db_user} / ${db_name}"
python3 - "$db_user" "$db_pass" "$db_name" <<'PY'
import subprocess
import sys

user, password, database = sys.argv[1], sys.argv[2], sys.argv[3]


def psql(sql: str) -> None:
    subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-c", sql],
        check=True,
    )


def quote_ident(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def quote_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


role = quote_ident(user)
db = quote_ident(database)
pwd = quote_literal(password)

exists = subprocess.check_output(
    [
        "sudo",
        "-u",
        "postgres",
        "psql",
        "-tAc",
        f"SELECT 1 FROM pg_roles WHERE rolname = {quote_literal(user)}",
    ],
    text=True,
).strip()
if exists == "1":
    psql(f"ALTER ROLE {role} WITH LOGIN PASSWORD {pwd}")
else:
    psql(f"CREATE ROLE {role} LOGIN PASSWORD {pwd}")

db_exists = subprocess.check_output(
    [
        "sudo",
        "-u",
        "postgres",
        "psql",
        "-tAc",
        f"SELECT 1 FROM pg_database WHERE datname = {quote_literal(database)}",
    ],
    text=True,
).strip()
if db_exists != "1":
    psql(f"CREATE DATABASE {db} OWNER {role}")
PY

if [[ "$db_host" != "127.0.0.1" && "$db_host" != "localhost" ]]; then
  echo "[remote] WARNING: DATABASE_URL host is ${db_host} (expected local Postgres on this VPS)"
fi

echo "[remote] activate pnpm@${PNPM_VERSION}"
corepack enable >/dev/null
corepack prepare "pnpm@${PNPM_VERSION}" --activate

echo "[remote] pnpm install + prisma"
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm exec prisma migrate deploy

echo "[remote] install systemd units"
install -m 644 "${REMOTE_DIR}/deploy/systemd/canvase-ui.service" /etc/systemd/system/canvase-ui.service
install -m 644 "${REMOTE_DIR}/deploy/systemd/canvase-worker.service" /etc/systemd/system/canvase-worker.service
sed -i "s|/opt/canvase-ui|${REMOTE_DIR}|g" \
  /etc/systemd/system/canvase-ui.service \
  /etc/systemd/system/canvase-worker.service
sed -i "s|-p 3917|-p ${APP_PORT}|g" /etc/systemd/system/canvase-ui.service
sed -i "s|PORT=3917|PORT=${APP_PORT}|g" /etc/systemd/system/canvase-ui.service

systemctl daemon-reload
systemctl enable canvase-ui canvase-worker
systemctl restart canvase-ui canvase-worker

echo "[remote] wait for app on :${APP_PORT}"
ok=0
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done
if [[ "$ok" -ne 1 ]]; then
  systemctl --no-pager --full status canvase-ui canvase-worker || true
  journalctl -u canvase-ui -n 80 --no-pager || true
  journalctl -u canvase-worker -n 40 --no-pager || true
  exit 1
fi
curl -fsS -o /dev/null -w "[remote] local HTTP %{http_code}\n" "http://127.0.0.1:${APP_PORT}/"

CADDYFILE=/etc/caddy/Caddyfile
BLOCK=$(cat <<EOF
${CADDY_BEGIN}
${DOMAIN}, www.${DOMAIN} {
	encode gzip zstd
	reverse_proxy 127.0.0.1:${APP_PORT}
}
${CADDY_END}
EOF
)

if grep -qF "$CADDY_BEGIN" "$CADDYFILE"; then
  echo "[remote] refresh Caddy site block for ${DOMAIN}"
  python3 - "$CADDYFILE" "$CADDY_BEGIN" "$CADDY_END" "$BLOCK" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
begin, end, block = sys.argv[2], sys.argv[3], sys.argv[4]
text = path.read_text()
start = text.find(begin)
stop = text.find(end)
if start < 0 or stop < 0 or stop < start:
    raise SystemExit("existing Caddy markers are malformed")
stop += len(end)
updated = text[:start] + block.rstrip() + "\n" + text[stop:].lstrip("\n")
path.write_text(updated)
PY
else
  echo "[remote] append Caddy site block for ${DOMAIN}"
  printf '\n%s\n' "$BLOCK" >>"$CADDYFILE"
fi

caddy validate --config "$CADDYFILE"
systemctl reload caddy

echo "[remote] done"
systemctl --no-pager --full status canvase-ui canvase-worker | sed -n '1,40p'
