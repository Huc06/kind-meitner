#!/bin/sh
set -eu
cd "$(dirname "$0")"
command -v podman >/dev/null
command -v podman-compose >/dev/null || { echo 'Install podman-compose first.' >&2; exit 1; }
if [ "$(id -u)" = 0 ]; then echo 'Run setup as a regular user with rootless Podman.' >&2; exit 1; fi
if [ "$(podman info --format '{{.Host.Security.Rootless}}')" != true ]; then
    echo 'This deployment requires a rootless Podman engine.' >&2
    exit 1
fi
systemctl --user enable --now podman.socket >/dev/null
if [ ! -f .env ]; then
    data_root="$HOME/kind-meitner/data"
    mkdir -p "$data_root"
    chmod 700 "$data_root"
    umask 077
    cat > .env <<EOF
COMPOSE_PROJECT_NAME=kind-meitner-podman
KIND_MEITNER_DATA_ROOT=$data_root
PODMAN_SOCKET=/run/user/$(id -u)/podman/podman.sock
KIND_MEITNER_PORT=8799
KIND_MEITNER_WEBHOOK_PORT=8800
KIND_MEITNER_HTTP_PORT=8080
KIND_MEITNER_PUBLIC_URL=http://localhost:8080
KIND_MEITNER_HTTPS_HOST=https-disabled.invalid
ENGINES=
EOF
fi
echo 'Ready: edit .env, then PODMAN_COMPOSE_PROVIDER=podman-compose podman compose --env-file .env -f compose.yaml up -d --build'
