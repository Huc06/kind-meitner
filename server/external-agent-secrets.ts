// Server-only secrets for external agents: per-connection bearer tokens, the
// Ed25519 key that signs one-time request proofs, and the X Layer TESTNET
// wallet used for approved x402 payments.
//
// Storage: DATA_DIR/external-agent-secrets.enc, AES-256-GCM, mode 0600, with
// its 32-byte key in DATA_DIR/external-agent-secrets.key (mode 0600). This
// protects against the secrets file alone leaking (a backup, a copied
// folder); it does NOT protect against someone who can read the whole data
// directory as this user. A hosted deployment should move the key into an
// OS keychain or KMS — that change needs its own security review.
//
// Nothing here is ever returned by an API, logged or written to messages.
import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

type SecretFile = {
  tokens: Record<string, string>;
  proofKey?: { privatePem: string; publicPem: string };
  testnetWallet?: { privateKey: `0x${string}` };
};

function writePrivate(path: string, data: Buffer | string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, data, { mode: 0o600 });
  renameSync(tmp, path);
  chmodSync(path, 0o600);
}

export class ExternalAgentSecrets {
  private readonly file: string;
  private readonly keyFile: string;
  private data: SecretFile = { tokens: {} };

  constructor(dataDir: string) {
    this.file = join(dataDir, "external-agent-secrets.enc");
    this.keyFile = join(dataDir, "external-agent-secrets.key");
    if (existsSync(this.file) && existsSync(this.keyFile)) {
      const raw = readFileSync(this.file);
      const key = readFileSync(this.keyFile);
      const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
      // Written only by this class, authenticated by GCM above.
      this.data = JSON.parse(plain) as SecretFile;
    }
  }

  private save(): void {
    if (!existsSync(this.keyFile)) writePrivate(this.keyFile, randomBytes(32));
    const key = readFileSync(this.keyFile);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(this.data), "utf8"), cipher.final()]);
    writePrivate(this.file, Buffer.concat([iv, cipher.getAuthTag(), body]));
  }

  token(connectionId: string): string | undefined {
    return this.data.tokens[connectionId];
  }
  setToken(connectionId: string, token: string): void {
    this.data.tokens[connectionId] = token;
    this.save();
  }
  deleteToken(connectionId: string): void {
    if (!(connectionId in this.data.tokens)) return;
    delete this.data.tokens[connectionId];
    this.save();
  }

  /** The public half agents use to verify X-KM-Request-Proof. */
  proofPublicKeyPem(): string {
    return this.proofKey().publicPem;
  }
  signProof(payload: string): string {
    return sign(null, Buffer.from(payload), createPrivateKey(this.proofKey().privatePem)).toString("base64url");
  }
  private proofKey(): { privatePem: string; publicPem: string } {
    if (!this.data.proofKey) {
      const { privateKey, publicKey } = generateKeyPairSync("ed25519");
      this.data.proofKey = {
        privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
        publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
      };
      this.save();
    }
    // Validate on read so a corrupted key fails loudly, not as a bad signature.
    createPublicKey(this.data.proofKey.publicPem);
    return this.data.proofKey;
  }

  /** Testnet-only wallet, created on first use. Only its address leaves the server. */
  testnetAccount() {
    if (!this.data.testnetWallet) {
      this.data.testnetWallet = { privateKey: generatePrivateKey() };
      this.save();
    }
    return privateKeyToAccount(this.data.testnetWallet.privateKey);
  }
}
