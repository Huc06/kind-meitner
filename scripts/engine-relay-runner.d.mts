export interface JobToValidate {
  id?: string;
  prompt?: unknown;
  model?: unknown;
  resumeSessionId?: unknown;
  system?: unknown;
}

export function validateJob(job: unknown): { ok: true } | { ok: false; error: string };

export function validateServerUrl(serverUrl: string): string;

export function executeJob(
  job: { id: string; prompt: string; model?: string; resumeSessionId?: string; system?: string },
  options: { baseUrl: string; token: string; claudeCli: string },
): Promise<boolean>;

export function runRunnerLoop(options: {
  baseUrl: string;
  token: string;
  claudeCli: string;
  signal?: AbortSignal;
}): Promise<void>;
