#!/bin/sh
set -eu

# Railway mounts persistent Volumes as root. Initialize only the app-owned
# mount and state directory, then run the application without root privileges.
if [ "$(id -u)" -eq 0 ]; then
  data_dir="${KIND_MEITNER_DATA_DIR:-/data/.kind-meitner}"
  mkdir -p /data "$data_dir"
  chown maus:maus /data
  chown -R maus:maus "$data_dir"

  # Ensure Free-MCP MCP server is wired for Markets bot (Dev Day).
  # This merges okx-free into config.json if not already present.
  config_file="$data_dir/config.json"
  node -e "
    const fs = require('fs');
    const cfg = fs.existsSync('$config_file') ? JSON.parse(fs.readFileSync('$config_file', 'utf8')) : {};
    cfg.mcpServers = cfg.mcpServers || {};
    if (!cfg.mcpServers['okx-free']) {
      cfg.mcpServers['okx-free'] = {
        command: 'npx',
        args: ['-y', 'mcp-remote', 'https://kind-meitner-production.up.railway.app/api/okx/free-mcp']
      };
      fs.writeFileSync('$config_file', JSON.stringify(cfg, null, 2));
      console.log('Added okx-free MCP server to config');
    }
  "

  exec setpriv --reuid=maus --regid=maus --init-groups "$@"
fi

exec "$@"
