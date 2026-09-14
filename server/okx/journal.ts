import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { writeFileAtomic } from "../atomic.ts";

export interface WebhookJournalEntry {
  id: string;
  type?: string;
  timestamp?: number;
  receivedAt: number;
}

/**
 * Deduplication Journal for OKX Webhooks.
 * Persists processed event IDs atomically with POSIX 0o600 permissions
 * to prevent duplicate handling across network retries or server restarts.
 */
export class OkxWebhookJournal {
  private readonly file?: string;
  private readonly entries = new Map<string, WebhookJournalEntry>();

  constructor(file?: string) {
    this.file = file;
    if (file && existsSync(file)) {
      try {
        const raw = readFileSync(file, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item.id === "string") {
              this.entries.set(item.id, {
                id: item.id,
                type: item.type,
                timestamp: item.timestamp,
                receivedAt: typeof item.receivedAt === "number" ? item.receivedAt : Date.now(),
              });
            }
          }
        }
      } catch {
        // Fallback gracefully on corrupted or unreadable journal file
      }
    }
  }

  has(eventId: string): boolean {
    if (!eventId || typeof eventId !== "string") return false;
    return this.entries.has(eventId);
  }

  record(event: { id: string; type?: string; timestamp?: number }): boolean {
    if (!event || !event.id || typeof event.id !== "string") {
      return false;
    }
    if (this.entries.has(event.id)) {
      return false;
    }
    const entry: WebhookJournalEntry = {
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      receivedAt: Date.now(),
    };
    this.entries.set(event.id, entry);
    this.save();
    return true;
  }

  get(eventId: string): WebhookJournalEntry | undefined {
    return this.entries.get(eventId);
  }

  list(): WebhookJournalEntry[] {
    return [...this.entries.values()];
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.save();
  }

  private save(): void {
    if (!this.file) return;
    const dir = dirname(this.file);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data = JSON.stringify([...this.entries.values()], null, 2);
    writeFileAtomic(this.file, data, { mode: 0o600 });
  }
}
