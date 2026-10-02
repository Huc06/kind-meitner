// Approval-gated x402 payments to external agents — X Layer TESTNET only.
//
// Flow: an agent answers HTTP 402 with a PAYMENT-REQUIRED challenge. The
// server checks policy (connection opted in, testnet network, exact scheme,
// per-request and monthly caps) and posts an approval card. Only an explicit
// Approve from the person signs an EIP-3009 authorization with the server's
// testnet wallet (official @okxweb3 x402 client) and retries the request.
// Mainnet networks are refused before any signing code runs. A payment is
// shown as settled only when the agent returns a PAYMENT-RESPONSE that says
// so; otherwise it stays "authorization signed, settlement not confirmed".
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { x402Client, x402HTTPClient } from "@okxweb3/x402-core/client";
import { decodePaymentResponseHeader } from "@okxweb3/x402-core/http";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/client";
import type { PrivateKeyAccount } from "viem/accounts";
import type { ExternalAgentConnection, PaymentRequiredChallenge } from "./external-agents.ts";

/** The only networks payments may use. X Layer testnet. */
export const TESTNET_NETWORKS: ReadonlySet<string> = new Set(["eip155:1952"]);
const PENDING_TTL_MS = 10 * 60_000;

type Requirement = PaymentRequiredChallenge["accepts"][number];

export type PendingPayment = {
  id: string;
  connectionId: string;
  groupId: string;
  threadId: string;
  requestId: string;
  text: string;
  conversationId?: string;
  messageId?: string;
  challenge: PaymentRequiredChallenge;
  requirement: Requirement;
  expiresAt: number;
};

export type LedgerEntry = {
  id: string;
  connectionId: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  payer: string;
  status: "signed" | "settled" | "settlement-failed";
  transaction?: string;
  at: string;
};

export type PaymentDecision = { ok: true; requirement: Requirement } | { ok: false; message: string };

function capFromEnv(name: string, fallback: bigint): bigint {
  const raw = process.env[name];
  return raw && /^\d{1,30}$/.test(raw) ? BigInt(raw) : fallback;
}

export class ExternalPayments {
  private readonly file: string;
  private ledger: LedgerEntry[] = [];
  private readonly pending = new Map<string, PendingPayment>();

  constructor(dataDir: string) {
    this.file = join(dataDir, "external-payments.json");
    if (existsSync(this.file)) {
      // Written only by this class.
      const parsed: unknown = JSON.parse(readFileSync(this.file, "utf8"));
      if (Array.isArray(parsed)) this.ledger = parsed as LedgerEntry[];
    }
  }

  /** Atomic token units; testnet stablecoins use 6 decimals (100000 = 0.10). */
  limits() {
    return {
      perRequest: capFromEnv("KIND_MEITNER_TESTNET_PAY_MAX_ATOMIC", 100_000n),
      monthly: capFromEnv("KIND_MEITNER_TESTNET_PAY_MONTHLY_ATOMIC", 1_000_000n),
    };
  }

  spentThisMonth(now = new Date()): bigint {
    const month = now.toISOString().slice(0, 7);
    return this.ledger.filter((entry) => entry.at.startsWith(month)).reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
  }

  evaluate(challenge: PaymentRequiredChallenge, connection: ExternalAgentConnection): PaymentDecision {
    if (!connection.paymentsTestnet) return { ok: false, message: "The agent asked for payment, but payments are off for this connection. Nothing was paid." };
    const testnet = challenge.accepts.filter((option) => option.scheme === "exact" && TESTNET_NETWORKS.has(option.network));
    if (testnet.length === 0) {
      const asked = challenge.accepts.map((option) => option.network).join(", ") || "an unknown network";
      return { ok: false, message: `Only X Layer testnet payments are enabled; the agent asked for ${asked}. Nothing was paid.` };
    }
    const { perRequest, monthly } = this.limits();
    const affordable = testnet.filter((option) => /^\d{1,30}$/.test(option.amount) && BigInt(option.amount) <= perRequest);
    if (affordable.length === 0) return { ok: false, message: `The agent asked for more than the per-request testnet limit (${perRequest} units). Nothing was paid.` };
    const cheapest = affordable.reduce((a, b) => (BigInt(a.amount) <= BigInt(b.amount) ? a : b));
    if (this.spentThisMonth() + BigInt(cheapest.amount) > monthly) {
      return { ok: false, message: `This payment would pass the monthly testnet limit (${monthly} units). Nothing was paid.` };
    }
    return { ok: true, requirement: cheapest };
  }

  createPending(input: Omit<PendingPayment, "id" | "expiresAt">): PendingPayment {
    const payment = { ...input, id: randomUUID(), expiresAt: Date.now() + PENDING_TTL_MS };
    this.pending.set(payment.id, payment);
    return payment;
  }

  /** Removes and returns a pending payment once; expired or unknown → undefined. */
  take(id: string): PendingPayment | undefined {
    const payment = this.pending.get(id);
    this.pending.delete(id);
    if (!payment || payment.expiresAt < Date.now()) return undefined;
    return payment;
  }

  /** Signs the approved requirement. Re-checks network and caps at signing time. */
  async sign(payment: PendingPayment, connection: ExternalAgentConnection, account: PrivateKeyAccount): Promise<{ headers: Record<string, string>; entry: LedgerEntry }> {
    const decision = this.evaluate({ ...payment.challenge, accepts: [payment.requirement] }, connection);
    if (!decision.ok) throw new Error(decision.message);
    const requirement = decision.requirement;
    const client = new x402HTTPClient(new x402Client().register(requirement.network as `${string}:${string}`, new ExactEvmScheme(account)));
    const payload = await client.createPaymentPayload({ ...payment.challenge, accepts: [requirement] });
    const entry: LedgerEntry = {
      id: payment.id,
      connectionId: connection.id,
      network: requirement.network,
      asset: requirement.asset,
      amount: requirement.amount,
      payTo: requirement.payTo,
      payer: account.address,
      status: "signed",
      at: new Date().toISOString(),
    };
    this.ledger.push(entry);
    this.save();
    return { headers: client.encodePaymentSignatureHeader(payload), entry };
  }

  /** Records the agent's PAYMENT-RESPONSE, if any. */
  settle(entryId: string, paymentResponseHeader?: string): LedgerEntry | undefined {
    const entry = this.ledger.find((candidate) => candidate.id === entryId);
    if (!entry || !paymentResponseHeader) return entry;
    try {
      const response = decodePaymentResponseHeader(paymentResponseHeader);
      entry.status = response.success ? "settled" : "settlement-failed";
      if (response.transaction) entry.transaction = String(response.transaction).slice(0, 100);
    } catch {
      entry.status = "settlement-failed";
    }
    this.save();
    return entry;
  }

  private save(): void {
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.ledger, null, 2), { mode: 0o600 });
    renameSync(tmp, this.file);
  }
}
