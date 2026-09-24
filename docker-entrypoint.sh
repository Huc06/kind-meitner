#!/bin/sh
set -eu

# Railway mounts persistent Volumes as root. Initialize only the app-owned
# mount and state directory, then run the application without root privileges.
if [ "$(id -u)" -eq 0 ]; then
  data_dir="${KIND_MEITNER_DATA_DIR:-/data/.kind-meitner}"
  mkdir -p /data "$data_dir"
  chown maus:maus /data
  chown -R maus:maus "$data_dir"

  # The in-process `agents` MCP server already exposes scan_free_mcp_readiness
  # and get_asp_trust_card to room bots, so the earlier okx-free stdio bridge
  # (`npx mcp-remote`) is redundant. It also left lingering npx/helper processes
  # that the harness could not confirm stopped after a turn. Remove it (and any
  # pre-existing entry) so the Markets bot uses the reliable in-process tools.
  config_file="$data_dir/config.json"
  node -e "
    const fs = require('fs');
    try {
      if (!fs.existsSync('$config_file')) process.exit(0);
      const cfg = JSON.parse(fs.readFileSync('$config_file', 'utf8'));
      if (cfg && typeof cfg === 'object' && cfg.mcpServers && cfg.mcpServers['okx-free']) {
        delete cfg.mcpServers['okx-free'];
        if (Object.keys(cfg.mcpServers).length === 0) delete cfg.mcpServers;
        fs.writeFileSync('$config_file', JSON.stringify(cfg, null, 2));
        console.log('Removed redundant okx-free MCP server from config');
      }
    } catch (err) {
      console.error('okx-free cleanup skipped:', err && err.message);
    }
    process.exit(0);
  "

  exec setpriv --reuid=maus --regid=maus --init-groups "$@"
fi

exec "$@"
