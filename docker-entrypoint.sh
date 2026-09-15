#!/bin/sh
set -eu

# Railway mounts persistent Volumes as root. Initialize only the app-owned
# mount and state directory, then run the application without root privileges.
if [ "$(id -u)" -eq 0 ]; then
  data_dir="${KIND_MEITNER_DATA_DIR:-/data/.kind-meitner}"
  mkdir -p /data "$data_dir"
  chown maus:maus /data
  chown -R maus:maus "$data_dir"
  exec setpriv --reuid=maus --regid=maus --init-groups "$@"
fi

exec "$@"
