// Exact app-owned browser state that belongs in an encrypted full backup.
// Never include cookies, authentication tokens, connection caches or unknown keys.
export const WORKSPACE_BACKUP_CLIENT_KEYS = [
  "kind-meitner-drafts",
  "kind-meitner-draft-attachments",
  "kind-meitner-draft-send-ids",
  "kind-meitner-draft-channel-modes",
  "kind-meitner-skin",
  "kind-meitner-show-threads",
  "kind-meitner.sidebarDensity",
  "kind-meitner.sidebarCollapsedSections.v1",
  "kind-meitner.sidebarSectionOrder.v1",
  "kind-meitner-analytics-opt-out",
  "kind-meitner.remote-voice.v1",
] as const;

export type WorkspaceBackupClientState = Partial<Record<(typeof WORKSPACE_BACKUP_CLIENT_KEYS)[number], string>>;
