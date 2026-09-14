import { EventEmitter } from "node:events";
import type { OkxGateway, OkxTaskRecord, OkxWebhookEvent } from "./gateway.ts";

/**
 * Escrow review window duration: 72 hours in milliseconds.
 * In OKX Onchain OS, smart contracts auto-release escrow to the seller if the buyer
 * does not act within this window.
 */
export const ESCROW_WINDOW_MS = 72 * 60 * 60 * 1000; // 259,200,000 ms

/**
 * Urgent review buffer: 12 hours in milliseconds.
 * If a delivered task has not been reviewed and the remaining review window drops
 * below this buffer, the watcher flags the task as urgent and escalates adjudication.
 */
export const URGENT_BUFFER_MS = 12 * 60 * 60 * 1000; // 43,200,000 ms

/**
 * Common defect markers indicating catastrophic deliverable failures.
 * Used for deterministic automated acceptance criteria checking.
 */
export const DEFAULT_DEFECT_MARKERS: readonly string[] = [
  "FATAL ERROR",
  "BUILD FAILED",
  "EXCEPTION_UNHANDLED",
  "UNHANDLED_EXCEPTION",
  "NULL_POINTER_EXCEPTION",
  "SEGMENTATION FAULT",
  "OUT OF MEMORY",
  "404 NOT FOUND",
  "SYNTAX ERROR",
  "TEST FAILED",
  "TESTS FAILED",
  "PANIC:",
  "CRASHED",
  "FAIL:",
  "FAILED:",
] as const;

export interface CriteriaEvaluationResult {
  passed: boolean;
  reason?: string;
  defectMarker?: string;
}

export interface DeliveryReviewResult {
  taskId: string;
  checked: boolean;
  passed?: boolean;
  action?: "accepted" | "rejected" | "skipped";
  reason?: string;
  txHash?: string;
  urgent?: boolean;
  expired?: boolean;
  timeRemainingMs?: number;
}

export interface OkxDeliveryWatcherConfig {
  gateway: OkxGateway;
  escrowWindowMs?: number;
  urgentBufferMs?: number;
  defectMarkers?: readonly string[];
  customEvaluator?: (
    task: OkxTaskRecord,
  ) => Promise<CriteriaEvaluationResult> | CriteriaEvaluationResult;
  now?: () => number;
  pollIntervalMs?: number;
  autoAttach?: boolean;
}

/**
 * Resolves the timestamp when a task was delivered.
 * Checks metadata.deliveredAt, then task.updatedAt, then task.createdAt.
 */
export function getTaskDeliveredAt(task: OkxTaskRecord): number {
  if (task.metadata && typeof task.metadata.deliveredAt === "number") {
    return task.metadata.deliveredAt;
  }
  if (task.status === "delivered" && typeof task.updatedAt === "number") {
    return task.updatedAt;
  }
  return task.createdAt;
}

/**
 * Deterministic acceptance criteria verification for deliverables.
 * Verifies non-empty deliverable content and absence of fatal defect markers.
 */
export function evaluateDeliverableCriteria(
  deliverable?: string,
  defectMarkers: readonly string[] = DEFAULT_DEFECT_MARKERS,
): CriteriaEvaluationResult {
  if (!deliverable || typeof deliverable !== "string") {
    return {
      passed: false,
      reason: "Deliverable is missing or undefined",
    };
  }

  const trimmed = deliverable.trim();
  if (trimmed.length === 0) {
    return {
      passed: false,
      reason: "Deliverable content is empty",
    };
  }

  const upper = deliverable.toUpperCase();
  for (const marker of defectMarkers) {
    if (upper.includes(marker.toUpperCase())) {
      return {
        passed: false,
        reason: `Automated acceptance criteria failed: defect marker "${marker}" detected in deliverable`,
        defectMarker: marker,
      };
    }
  }

  return { passed: true };
}

/**
 * Autonomous Delivery Review Daemon (OkxDeliveryWatcher).
 * Monitors active tasks in the 72-hour escrow review window, adjudicates acceptance criteria,
 * automatically calls agentAccept on passing deliverables to release escrow, or calls
 * agentReject on defective deliverables before the 72h auto-release deadline to lock funds into dispute.
 */
export class OkxDeliveryWatcher extends EventEmitter {
  readonly gateway: OkxGateway;
  readonly escrowWindowMs: number;
  readonly urgentBufferMs: number;
  readonly defectMarkers: readonly string[];
  private readonly customEvaluator?: (
    task: OkxTaskRecord,
  ) => Promise<CriteriaEvaluationResult> | CriteriaEvaluationResult;
  private readonly now: () => number;
  private pollTimer?: NodeJS.Timeout;
  private gatewayCleanup?: () => void;

  constructor(config: OkxDeliveryWatcherConfig) {
    super();
    this.gateway = config.gateway;
    this.escrowWindowMs = config.escrowWindowMs ?? ESCROW_WINDOW_MS;
    this.urgentBufferMs = config.urgentBufferMs ?? URGENT_BUFFER_MS;
    this.defectMarkers = config.defectMarkers ?? DEFAULT_DEFECT_MARKERS;
    this.customEvaluator = config.customEvaluator;
    this.now = config.now ?? (() => Date.now());

    if (config.autoAttach !== false && typeof (this.gateway as any).on === "function") {
      this.attachToGateway(this.gateway);
    }

    if (config.pollIntervalMs && config.pollIntervalMs > 0) {
      this.startPolling(config.pollIntervalMs);
    }
  }

  /**
   * Computes the absolute timestamp when auto-release will occur on-chain.
   */
  getDeliveryDeadline(task: OkxTaskRecord): number {
    const deliveredAt = getTaskDeliveredAt(task);
    return deliveredAt + this.escrowWindowMs;
  }

  /**
   * Computes milliseconds remaining before the 72-hour escrow auto-release expires.
   */
  getTimeRemainingMs(task: OkxTaskRecord, now?: number): number {
    const current = now ?? this.now();
    return this.getDeliveryDeadline(task) - current;
  }

  /**
   * Returns true if the remaining review time is within the urgent buffer (< 12 hours) and unexpired.
   */
  isUrgent(task: OkxTaskRecord, now?: number): boolean {
    const remaining = this.getTimeRemainingMs(task, now);
    return remaining > 0 && remaining <= this.urgentBufferMs;
  }

  /**
   * Returns true if the 72-hour escrow review window has elapsed.
   */
  isExpired(task: OkxTaskRecord, now?: number): boolean {
    return this.getTimeRemainingMs(task, now) <= 0;
  }

  /**
   * Evaluates deliverable criteria combining deterministic defect markers and optional custom evaluator.
   */
  async evaluateDeliverable(task: OkxTaskRecord): Promise<CriteriaEvaluationResult> {
    const baseResult = evaluateDeliverableCriteria(task.deliverable, this.defectMarkers);
    if (!baseResult.passed) {
      return baseResult;
    }
    if (this.customEvaluator) {
      return await this.customEvaluator(task);
    }
    return { passed: true };
  }

  /**
   * Reviews an individual task by ID.
   * If passing: executes agentAccept and marks task completed.
   * If failing: executes agentReject with grievance reason and locks escrow into dispute.
   */
  async checkTask(taskId: string): Promise<DeliveryReviewResult> {
    const task = this.gateway.ledger.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in ledger`);
    }

    const current = this.now();
    const remainingMs = this.getTimeRemainingMs(task, current);
    const urgent = this.isUrgent(task, current);
    const expired = this.isExpired(task, current);

    if (urgent) {
      this.emit("urgent_task", { task, timeRemainingMs: remainingMs });
    }

    if (task.status !== "delivered") {
      return {
        taskId,
        checked: false,
        action: "skipped",
        reason: `Task is not in delivered status (current status: ${task.status})`,
        timeRemainingMs: remainingMs,
        urgent,
        expired,
      };
    }

    if (expired) {
      return {
        taskId,
        checked: false,
        action: "skipped",
        reason: `Escrow 72-hour review window has expired (${Math.abs(remainingMs)}ms past deadline)`,
        timeRemainingMs: remainingMs,
        urgent: false,
        expired: true,
      };
    }

    const evaluation = await this.evaluateDeliverable(task);

    if (evaluation.passed) {
      const acceptRes = await this.gateway.cli.agentAccept(task.id);
      this.gateway.ledger.updateTaskStatus(task.id, "completed", {
        txHash: acceptRes.txHash,
      });
      const result: DeliveryReviewResult = {
        taskId,
        checked: true,
        passed: true,
        action: "accepted",
        txHash: acceptRes.txHash,
        timeRemainingMs: remainingMs,
        urgent,
        expired: false,
      };
      this.emit("delivery_accepted", { task, txHash: acceptRes.txHash, result });
      return result;
    } else {
      const reason = evaluation.reason || "Deliverable failed automated acceptance criteria";
      const rejectRes = await this.gateway.cli.agentReject(task.id, reason);
      this.gateway.ledger.updateTaskStatus(task.id, "rejected", {
        rejectionReason: reason,
        txHash: rejectRes.txHash,
      });
      const result: DeliveryReviewResult = {
        taskId,
        checked: true,
        passed: false,
        action: "rejected",
        reason,
        txHash: rejectRes.txHash,
        timeRemainingMs: remainingMs,
        urgent,
        expired: false,
      };
      this.emit("delivery_rejected", { task, reason, txHash: rejectRes.txHash, result });
      return result;
    }
  }

  /**
   * Reviews all tasks currently in "delivered" status in the ledger.
   */
  async reviewPendingDeliveries(): Promise<DeliveryReviewResult[]> {
    const deliveredTasks = this.gateway.ledger.listTasks({ status: "delivered" });
    const results: DeliveryReviewResult[] = [];
    for (const task of deliveredTasks) {
      try {
        const res = await this.checkTask(task.id);
        results.push(res);
      } catch (err) {
        this.emit("error", { taskId: task.id, error: err });
      }
    }
    this.emit("review_completed", { count: results.length, results });
    return results;
  }

  /**
   * Attaches event listeners to the OkxGateway instance to react to incoming webhook events.
   */
  attachToGateway(gateway: OkxGateway): void {
    if (this.gatewayCleanup) {
      this.gatewayCleanup();
    }
    const onDeliverySubmitted = async (event: OkxWebhookEvent) => {
      const taskId = event.data?.taskId;
      if (taskId) {
        try {
          await this.checkTask(taskId);
        } catch (err) {
          this.emit("error", { taskId, error: err });
        }
      }
    };

    gateway.on("delivery_submitted", onDeliverySubmitted);
    this.gatewayCleanup = () => {
      gateway.removeListener("delivery_submitted", onDeliverySubmitted);
    };
  }

  /**
   * Starts periodic polling of pending delivered tasks.
   */
  startPolling(intervalMs = 60_000): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.reviewPendingDeliveries().catch((err) => {
        this.emit("error", { error: err });
      });
    }, intervalMs);
    if (typeof this.pollTimer.unref === "function") {
      this.pollTimer.unref();
    }
  }

  /**
   * Stops periodic polling.
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  /**
   * Cleans up timer and listeners.
   */
  destroy(): void {
    this.stopPolling();
    if (this.gatewayCleanup) {
      this.gatewayCleanup();
      this.gatewayCleanup = undefined;
    }
    this.removeAllListeners();
  }
}
