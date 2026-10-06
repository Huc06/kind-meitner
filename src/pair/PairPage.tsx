import { useEffect, useState } from "react";
import { DesktopWorkspaceSwitcher } from "../components/DesktopWorkspaceSwitcher";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/field";
import { Frame } from "@/components/ui/frame";
import {
  defaultDeviceLabel,
  newAttemptId,
  pairWithCode,
  readSessionState,
  reasonWorthShowing,
  startEmailSignIn,
  verifyEmailSignIn,
  type EnvironmentDescriptor,
  type SessionState,
} from "../lib/session";

// styled via UI primitives

/** The page a pairing link opens: /pair#code=XXXX-XXXX-XXXX. Also what the
 * app shows instead of itself when a remote browser has no session yet.
 * When the server has a sign-in allow-list, "sign in with your email" comes
 * first and the pairing code stays one link away. */
export function PairPage({ initialCode, initialEmail = null, reason }: { initialCode: string | null; initialEmail?: string | null; reason?: string }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [label, setLabel] = useState(defaultDeviceLabel());
  const [environment, setEnvironment] = useState<EnvironmentDescriptor | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // one id per code typed: a retry after a lost response reuses it, a new code gets a new one
  const [attemptId, setAttemptId] = useState(() => newAttemptId());
  const [mode, setMode] = useState<"email" | "code" | null>(initialCode ? "code" : null);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    void fetch("/.well-known/kind-meitner/environment")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EnvironmentDescriptor | null) => {
        setEnvironment(d);
        setMode((current) => current ?? (d?.capabilities.emailSignIn ? "email" : "code"));
      })
      .catch(() => {
        setEnvironment(null);
        setMode((current) => current ?? "code");
      });
    void readSessionState().then(setSession);
  }, []);

  const connected = session?.kind === "loopback" || session?.kind === "session";
  const emailOffered = environment?.capabilities.emailSignIn === true;

  function destinationUrl(): string {
    try {
      const params = new URLSearchParams(location.search);
      const returnTo = params.get("return_to");
      if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        return returnTo;
      }
      if (location.pathname !== "/pair" && location.pathname.startsWith("/")) {
        return `${location.pathname}${location.search}${location.hash}`;
      }
    } catch {}
    return "/";
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await pairWithCode({ code, label, attemptId });
    setBusy(false);
    if (result.ok) {
      location.replace(destinationUrl());
      return;
    }
    setError(result.error);
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = sent ? await verifyEmailSignIn({ email, code: otp, label }) : await startEmailSignIn(email);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (sent) {
      location.replace(destinationUrl());
      return;
    }
    setSent(true);
  }

  function switchMode(next: "email" | "code") {
    setMode(next);
    setError(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-app px-6 text-ink">
      <div className="absolute left-3 top-12 max-w-[280px]"><DesktopWorkspaceSwitcher /></div>
      <Frame title={mode === "email" ? "SIGN IN" : "PAIRING"} surface="app" className="w-full max-w-[440px] bg-card p-6">
        <h1 className="text-[18px] font-semibold text-ink">
          {mode === "email" ? "Sign in to" : "Connect to"} {environment?.label ?? "this kind-meitner"}
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
          {environment ? `Version ${environment.version} on ${environment.platform}. ` : ""}
          {mode === "email"
            ? sent
              ? `We emailed an 8-digit code to ${email}. It works once and expires in ten minutes.`
              : "Enter your email and we will send you a one-time code."
            : "Enter the pairing code shown on the server. Codes work once and expire after five minutes."}
        </p>
        {reasonWorthShowing(reason) && !connected ? <p className="mt-3 font-mono text-[11px] text-ink-secondary">{reasonWorthShowing(reason)}</p> : null}
        {connected ? (
          <p className="mt-4 text-[13.5px]">
            This browser is already connected.{" "}
            <a href="/" className="text-accent underline">
              Open the app
            </a>
          </p>
        ) : mode === "email" ? (
          <form onSubmit={submitEmail} className="mt-4">
            <FieldLabel htmlFor="signin-email">Email</FieldLabel>
            <Input
              id="signin-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSent(false);
                setOtp("");
              }}
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
            />
            {sent ? (
              <div className="mt-4">
                <FieldLabel htmlFor="signin-code">Code from the email</FieldLabel>
                <Input
                  id="signin-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="12345678"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  spellCheck={false}
                  className="font-mono text-[15px] tracking-[0.12em]"
                />
                <div className="mt-2.5 flex items-center justify-center gap-1.5 font-mono">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const clean = otp.replace(/\D/g, "");
                    const digit = clean[i] ?? "";
                    return (
                      <span
                        key={i}
                        className="inline-flex size-8 items-center justify-center border border-hairline bg-inset text-[16px] font-semibold text-ink"
                      >
                        {digit}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-4">
                  <FieldLabel htmlFor="signin-label">This device</FieldLabel>
                  <Input id="signin-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
                </div>
              </div>
            ) : null}
            {error ? <p role="alert" className="mt-3 font-mono text-[11px] text-danger">{error}</p> : null}
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={busy || !email.includes("@") || (sent && otp.replace(/\D/g, "").length < 8)}
              className="mt-5 w-full"
            >
              {busy ? (sent ? "Signing in…" : "Sending…") : sent ? "Sign in" : "Send code"}
            </Button>
            {sent ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSent(false)} className="mt-3 w-full">
                Send a new code
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={() => switchMode("code")} className="mt-3 w-full">
              Have a pairing code instead?
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="mt-4">
            <FieldLabel htmlFor="pair-code">Pairing code</FieldLabel>
            <Input
              id="pair-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setAttemptId(newAttemptId());
              }}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono text-[15px] tracking-[0.12em] uppercase"
            />
            {/* Visual Kbd-like digit cells */}
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1 font-mono">
              {Array.from({ length: 12 }).map((_, i) => {
                const clean = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                const char = clean[i] ?? "";
                return (
                  <span
                    key={i}
                    className="inline-flex size-7 items-center justify-center border border-hairline bg-inset text-[13px] font-semibold text-ink"
                  >
                    {char}
                  </span>
                );
              })}
            </div>
            <div className="mt-4">
              <FieldLabel htmlFor="pair-label">This device</FieldLabel>
              <Input id="pair-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
            </div>
            {error ? <p role="alert" className="mt-3 font-mono text-[11px] text-danger">{error}</p> : null}
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={busy || code.replace(/[^a-z0-9]/gi, "").length < 12}
              className="mt-5 w-full"
            >
              {busy ? "Connecting…" : "Connect"}
            </Button>
            {emailOffered ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => switchMode("email")} className="mt-3 w-full">
                Sign in with your email instead
              </Button>
            ) : null}
          </form>
        )}
      </Frame>
    </main>
  );
}
