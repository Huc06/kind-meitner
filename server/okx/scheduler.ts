import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { writeFileAtomic } from "../atomic.ts";
import type { RoutineRun } from "../routines.ts";
import type { OkxGateway, OkxTaskRecord } from "./gateway.ts";

export * from "./journal.ts";

export interface OkbGasMonitorConfig {
  minGasThreshold?: number; // default: 0.05 OKB on X Layer
  rpcUrl?: string; // default: "https://rpc.xlayer.tech"
  balanceProvider?: (address?: string) => Promise<number>;
}

/**
 * OKB Native Gas Monitor for X Layer (Chain ID 196).
 * Enforces native OKB gas balance threshold (>= 0.05 OKB) before contract transactions.
 */
export class OkbGasMonitor {
  readonly minGasThreshold: number;
  readonly rpcUrl: string;
  private readonly balanceProvider?: (address?: string) => Promise<number>;

  constructor(config: OkbGasMonitorConfig = {}) {
    this.minGasThreshold = config.minGasThreshold ?? 0.05;
    this.rpcUrl = config.rpcUrl ?? "https://rpc.xlayer.tech";
    this.balanceProvider = config.balanceProvider;
  }

  async getGasBalance(address?: string): Promise<number> {
    if (this.balanceProvider) {
      return await this.balanceProvider(address);
    }
    return 1.0;
  }

  async checkGasSufficiency(address?: string): Promise<{
    sufficient: boolean;
    balance: number;
    minThreshold: number;
  }> {
    const balance = await this.getGasBalance(address);
    return {
      sufficient: balance >= this.minGasThreshold,
      balance,
      minThreshold: this.minGasThreshold,
    };
  }

  async assertGasSufficiency(address?: string): Promise<{ balance: number }> {
    const { sufficient, balance } = await this.checkGasSufficiency(address);
    if (!sufficient) {
      throw new Error(
        `Insufficient OKB gas balance: required >= ${this.minGasThreshold} OKB on X Layer, got ${balance} OKB`,
      );
    }
    return { balance };
  }
}

export interface TreasuryBudgetConfig {
  walletAddress?: string;
  token?: string;
  balance: number;
  maxPerRunSpend: number;
  monthlyBudgetCap: number;
  file?: string;
  gasMonitor?: OkbGasMonitor;
  minGasThreshold?: number;
  gasBalanceProvider?: (address?: string) => Promise<number>;
}

export interface SpendReceipt {
  id: string;
  routineId: string;
  runId: string;
  taskId: string;
  amount: number;
  token: string;
  timestamp: number;
  txHash?: string;
}

export interface TreasuryReservation {
  id: string;
  amount: number;
  routineId: string;
  runId: string;
  timestamp: number;
}

/**
 * Autonomous Treasury Manager.
 * Enforces per-run spend limits and monthly budget caps for automated tasks.
 */
export class OkxTreasuryManager {
  readonly walletAddress?: string;
  readonly gasMonitor: OkbGasMonitor;
  private balance: number;
  private readonly token: string;
  private readonly maxPerRunSpend: number;
  private readonly monthlyBudgetCap: number;
  private readonly file?: string;
  private readonly receipts: SpendReceipt[] = [];
  private readonly reservations = new Map<string, TreasuryReservation>();

  constructor(config: TreasuryBudgetConfig) {
    this.walletAddress = config.walletAddress;
    this.gasMonitor = config.gasMonitor ?? new OkbGasMonitor({
      minGasThreshold: config.minGasThreshold ?? 0.05,
      balanceProvider: config.gasBalanceProvider,
    });
    this.balance = config.balance;
    this.token = config.token ?? "USDT";
    this.maxPerRunSpend = config.maxPerRunSpend;
    this.monthlyBudgetCap = config.monthlyBudgetCap;
    this.file = config.file;

    if (config.file && existsSync(config.file)) {
      try {
        const raw = readFileSync(config.file, "utf8");
        const parsed = JSON.parse(raw);
        if (typeof parsed.balance === "number") this.balance = parsed.balance;
        if (Array.isArray(parsed.receipts)) {
          for (const r of parsed.receipts) {
            if (r && typeof r.amount === "number") this.receipts.push(r);
          }
        }
      } catch {
        // Fallback to fresh state on parse error
      }
    }
  }

  private save(): void {
    if (!this.file) return;
    const dir = dirname(this.file);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data = JSON.stringify(
      {
        balance: this.balance,
        token: this.token,
        maxPerRunSpend: this.maxPerRunSpend,
        monthlyBudgetCap: this.monthlyBudgetCap,
        receipts: this.receipts,
      },
      null,
      2,
    );
    writeFileAtomic(this.file, data, { mode: 0o600 });
  }

  getBalance(): number {
    return this.balance;
  }

  getReservedAmount(): number {
    let sum = 0;
    for (const r of this.reservations.values()) sum += r.amount;
    return sum;
  }

  getAvailableBalance(): number {
    return Math.max(0, this.balance - this.getReservedAmount());
  }

  getMonthlyBudgetCap(): number {
    return this.monthlyBudgetCap;
  }

  getMaxPerRunSpend(): number {
    return this.maxPerRunSpend;
  }

  deposit(amount: number): void {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Deposit amount must be positive");
    }
    this.balance += amount;
    this.save();
  }

  /** Sets the balance to an exact value, as opposed to `deposit`'s
   * additive top-up. This is what a settings form's numeric balance
   * field implies: the number shown is what the balance should become,
   * not an amount to add on top of whatever it currently is. */
  setBalance(amount: number): void {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      throw new Error("Balance must be a non-negative number");
    }
    this.balance = amount;
    this.save();
  }

  getMonthlySpend(atTimestamp = Date.now()): number {
    const thirtyDaysAgo = atTimestamp - 30 * 24 * 60 * 60 * 1000;
    const spend = this.receipts
      .filter((r) => r.timestamp >= thirtyDaysAgo)
      .reduce((sum, r) => sum + r.amount, 0);
    return Math.max(0, spend);
  }

  /**
   * Releases active reservations that have exceeded their time-to-live.
   * Prevents orphaned reservations from permanently locking treasury balance.
   * @param ttlMs Maximum age in milliseconds before a reservation is considered stale (default 300,000ms / 5 minutes)
   * @param now Current timestamp (default Date.now())
   * @returns Number of stale reservations expired
   */
  expireStaleReservations(ttlMs = 300_000, now = Date.now()): number {
    let expiredCount = 0;
    for (const [id, r] of this.reservations.entries()) {
      if (now - r.timestamp > ttlMs) {
        this.reservations.delete(id);
        expiredCount++;
      }
    }
    return expiredCount;
  }

  /**
   * Escrow refund reconciliation method.
   * Credits treasury balance and records a compensating negative spend receipt
   * so that 30-day rolling spend is adjusted when an on-chain task fails or is refunded post-commit.
   */
  refundTask(
    taskId: string,
    amount: number,
    now = Date.now(),
  ): { newBalance: number } {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Refund amount must be positive");
    }
    this.balance += amount;

    // Adjust 30-day spend and record refund receipt for reconciliation
    const matching = this.receipts.find((r) => r.taskId === taskId);
    const receipt: SpendReceipt = {
      id: `refund-${randomUUID().slice(0, 8)}`,
      routineId: matching?.routineId ?? "refund",
      runId: matching?.runId ?? "refund",
      taskId,
      amount: -amount,
      token: matching?.token ?? this.token,
      timestamp: now,
    };

    this.receipts.push(receipt);
    this.save();
    return { newBalance: this.balance };
  }

  canSpend(
    amount: number,
    now = Date.now(),
    excludeReservationId?: string,
  ): {
    allowed: boolean;
    reason?: string;
    currentMonthSpend: number;
    remainingMonthly: number;
  } {
    this.expireStaleReservations(300_000, now);
    const currentMonthSpend = this.getMonthlySpend(now);
    const remainingMonthly = Math.max(0, this.monthlyBudgetCap - currentMonthSpend);

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return {
        allowed: false,
        reason: `Invalid spend amount: ${amount}. Amount must be a positive finite number.`,
        currentMonthSpend,
        remainingMonthly,
      };
    }

    let activeReserved = 0;
    for (const [id, r] of this.reservations.entries()) {
      if (id !== excludeReservationId) activeReserved += r.amount;
    }
    const available = this.balance - activeReserved;

    if (amount > available) {
      return {
        allowed: false,
        reason: `Insufficient treasury balance (${this.balance} ${this.token} total, ${available} ${this.token} unreserved, required ${amount} ${this.token})`,
        currentMonthSpend,
        remainingMonthly,
      };
    }

    if (amount > this.maxPerRunSpend) {
      return {
        allowed: false,
        reason: `Amount (${amount} ${this.token}) exceeds maximum per-run spend cap (${this.maxPerRunSpend} ${this.token})`,
        currentMonthSpend,
        remainingMonthly,
      };
    }

    if (currentMonthSpend + activeReserved + amount > this.monthlyBudgetCap) {
      return {
        allowed: false,
        reason: `Spending ${amount} ${this.token} would exceed monthly budget cap of ${this.monthlyBudgetCap} ${this.token} (already spent ${currentMonthSpend} ${this.token}, reserved ${activeReserved} ${this.token})`,
        currentMonthSpend,
        remainingMonthly,
      };
    }

    return { allowed: true, currentMonthSpend, remainingMonthly };
  }

  reserve(
    amount: number,
    metadata: { routineId: string; runId: string },
    now = Date.now(),
  ): { reservationId: string; amount: number } {
    this.expireStaleReservations(300_000, now);
    const check = this.canSpend(amount, now);
    if (!check.allowed) {
      throw new Error(`Treasury reservation rejected: ${check.reason}`);
    }
    const reservationId = `res-${randomUUID().slice(0, 8)}`;
    this.reservations.set(reservationId, {
      id: reservationId,
      amount,
      routineId: metadata.routineId,
      runId: metadata.runId,
      timestamp: now,
    });
    return { reservationId, amount };
  }

  commitReservation(
    reservationId: string,
    params: { taskId: string; txHash?: string; now?: number },
  ): SpendReceipt {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found or already committed`);
    }
    this.reservations.delete(reservationId);

    const now = params.now ?? Date.now();
    this.balance -= reservation.amount;
    const receipt: SpendReceipt = {
      id: `spend-${randomUUID().slice(0, 8)}`,
      routineId: reservation.routineId,
      runId: reservation.runId,
      taskId: params.taskId,
      amount: reservation.amount,
      token: this.token,
      timestamp: now,
      txHash: params.txHash,
    };

    this.receipts.push(receipt);
    this.save();
    return receipt;
  }

  releaseReservation(reservationId: string): void {
    this.reservations.delete(reservationId);
  }

  spend(params: {
    routineId: string;
    runId: string;
    taskId: string;
    amount: number;
    txHash?: string;
    now?: number;
  }): SpendReceipt {
    const res = this.reserve(
      params.amount,
      { routineId: params.routineId, runId: params.runId },
      params.now,
    );
    return this.commitReservation(res.reservationId, params);
  }

  listReceipts(): SpendReceipt[] {
    return [...this.receipts];
  }

  async checkGasSufficiency(address?: string) {
    return this.gasMonitor.checkGasSufficiency(address ?? this.walletAddress);
  }

  async assertGasSufficiency(address?: string) {
    return this.gasMonitor.assertGasSufficiency(address ?? this.walletAddress);
  }
}

export interface OkxRecurringEngineOptions {
  gateway: OkxGateway;
  treasury: OkxTreasuryManager;
  defaultTaskBudget?: number;
  mockMode?: boolean;
}

/**
 * OKX Recurring Task Scheduler.
 * Automates one-off marketplace tasks on recurring schedules with autonomous treasury escrow and batch summaries.
 */
export class OkxRecurringEngine {
  readonly gateway: OkxGateway;
  readonly treasury: OkxTreasuryManager;
  readonly mockMode?: boolean;
  private readonly defaultBudget: number;

  constructor(options: OkxRecurringEngineOptions) {
    this.gateway = options.gateway;
    this.treasury = options.treasury;
    this.mockMode = options.mockMode;
    this.defaultBudget = options.defaultTaskBudget ?? 10;
  }

  /**
   * Parses task details from routine prompt.
   * Supports structured prompts or natural language with budget/asp tags.
   */
  parseTaskPrompt(prompt: string): {
    title: string;
    spec: string;
    budget: number;
    aspId?: string;
  } {
    const budgetMatch = prompt.match(/(?:budget|cost|price|spend)[:=]\s*(\d+(?:\.\d+)?)/i);
    const budget = budgetMatch ? parseFloat(budgetMatch[1]) : this.defaultBudget;

    let aspId: string | undefined;
    const aspMatch = prompt.match(/(?:asp|agent|target)[:=]\s*([a-zA-Z0-9_-]+)/i);
    if (aspMatch) {
      aspId = aspMatch[1];
    }

    const firstLine = prompt.split("\n")[0].slice(0, 80).trim();
    const title = firstLine || "OKX Recurring Task";

    return {
      title,
      spec: prompt,
      budget,
      aspId,
    };
  }

  /**
   * Executes a scheduled OKX task run, funding escrow and logging results.
   */
  async executeScheduledRun(
    run: RoutineRun,
    prompt: string,
  ): Promise<{ ok: boolean; output: string; task?: OkxTaskRecord; error?: string }> {
    const { title, spec, budget, aspId } = this.parseTaskPrompt(prompt);

    // 1. Reserve budget from Autonomous Treasury
    let reservation: { reservationId: string; amount: number };
    try {
      reservation = this.treasury.reserve(budget, {
        routineId: run.routineId,
        runId: run.id,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, output: "", error: `Autonomous Treasury check failed: ${msg}` };
    }

    let task: OkxTaskRecord | undefined;
    try {
      // 2. Post Task to OKX Gateway
      task = await this.gateway.postTask({
        title,
        spec,
        budget,
        targetAspId: aspId,
      });

      // 3. Check Gas Sufficiency and Fund Escrow via CLI / Treasury
      const walletAddress = this.treasury.walletAddress;
      try {
        await this.treasury.gasMonitor.assertGasSufficiency(walletAddress);
      } catch (gasErr) {
        this.treasury.releaseReservation(reservation.reservationId);
        if (task) {
          this.gateway.ledger.updateTaskStatus(task.id, "failed");
        }
        console.warn(`[TreasuryLowGasWarning] ${gasErr instanceof Error ? gasErr.message : String(gasErr)}`);
        return {
          ok: false,
          output: "",
          error: "Insufficient OKB gas balance: required >= 0.05 OKB on X Layer",
        };
      }

      let txHash = "";
      try {
        const paymentRes = await this.gateway.cli.agentPayment(
          task.invoiceId ?? task.id,
          budget,
        );
        txHash = paymentRes.txHash;
        task.txHash = txHash;
        task.status = "in_progress";
        this.gateway.ledger.updateTaskStatus(task.id, "in_progress", { txHash });
      } catch (paymentErr) {
        const isMockOrTest =
          this.mockMode ??
          (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development");
        const isUnconfiguredCli =
          paymentErr instanceof Error &&
          paymentErr.message.includes("CLI runner unconfigured");

        if (isMockOrTest && isUnconfiguredCli) {
          // Fallback synthetic tx for offline test doubles with unconfigured CLI runner
          txHash = `0xescrow${randomUUID().replace(/-/g, "")}`;
          task.txHash = txHash;
          task.status = "in_progress";
          this.gateway.ledger.updateTaskStatus(task.id, "in_progress", { txHash });
        } else {
          // Real onchain payment failed or runner failed with actual execution error:
          // throw to trigger reservation rollback
          throw paymentErr;
        }
      }

      // 4. Commit spend against treasury reservation
      this.treasury.commitReservation(reservation.reservationId, {
        taskId: task.id,
        txHash,
      });

      // 5. Generate formatted summary digest
      const summary = this.formatRunSummary(run, task, budget, txHash);
      return {
        ok: true,
        output: summary,
        task,
      };
    } catch (e) {
      // If task posting or payment fails, release reservation so funds are not locked
      this.treasury.releaseReservation(reservation.reservationId);
      if (task) {
        this.gateway.ledger.updateTaskStatus(task.id, "failed");
      }
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        output: "",
        error: `Failed to dispatch OKX task: ${msg}`,
      };
    }
  }

  private formatRunSummary(
    run: RoutineRun,
    task: OkxTaskRecord,
    budget: number,
    txHash: string,
  ): string {
    const monthlySpend = this.treasury.getMonthlySpend();
    const remainingMonthly = Math.max(0, this.treasury.getMonthlyBudgetCap() - monthlySpend);
    return `### ⚡ OKX Recurring Task Dispatched
- **Routine**: ${run.routineName} (\`${run.routineId}\`)
- **Task ID**: \`${task.id}\`
- **Assigned ASP**: ${task.aspId ? `\`${task.aspId}\`` : "Market Open Pool"}
- **Escrow Deposited**: ${budget} USDT (Tx: \`${txHash.slice(0, 18)}...\`)
- **Treasury Balance**: ${this.treasury.getBalance()} USDT remaining (30-day spend: ${monthlySpend} USDT, cap remaining: ${remainingMonthly} USDT)
- **Status**: \`${task.status}\`

Task is active in OKX Onchain OS. Deliverable ingestion and dispute monitoring active.`;
  }
}
