import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { t } from "@/lib/i18n";
import { PhonePreview } from "@/components/onboarding/PhonePreview";
import {
  ArrowLeft,
  Check,
  Loader2,
  Mail,
  QrCode,
  ShieldCheck,
  Smartphone,
  Wifi,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Frame } from "@/components/ui/frame";
import { Input, FieldLabel } from "@/components/ui/field";
import {
  companionPairingLink,
  companionPairingRoute,
  companionPairingRoutePin,
  companionPairingRoutePinAvailable,
  type CompanionEndpoint,
  type CompanionPairingRoutePin,
  type CompanionPairingRouteMode,
} from "../lib/companion-pairing";
import {
  PHONE_SETUP_PROVISIONING_TIMEOUT_MS,
  claimPhonePairingAttempt,
  closePhonePairingIfOwned,
  completePhonePairingAttempt,
  companionPairingMode,
  companionPairingOpenFailure,
  companionStartFailure,
  derivePhoneSetupPhase,
  initialPhoneSetupFlowState,
  keepPhonePairingIfCurrent,
  invalidatePhonePairingAttempt,
  newlyPairedDeviceForFlow,
  normalizePhoneSetupActionError,
  phonePairingGate,
  phoneSetupBaseline,
  phoneSetupReducer,
  preparePhonePairingRoute,
  queuePhonePairingAttempt,
  releasePhonePairingAttempt,
  shouldArmPhoneSetupProvisioningTimeout,
  startNonOverlappingPhoneSetupPoll,
  type PhoneSetupPhase,
  type PhonePairingAttemptLock,
  type PhonePairingAttemptQueue,
} from "../lib/phone-setup";
import type { CompanionAccountState } from "../types/ogb";
import { ConnectionDetail } from "./ConnectionDetail";
import { brand } from "../lib/brand";

export interface PhoneDevice {
  id: string;
  name: string;
  createdAt: number;
  lastSeenAt: number;
  cloudDesktopAccess: boolean;
}

export interface CompanionState {
  enabled: boolean;
  keepAwake: boolean;
  port: number;
  devices: PhoneDevice[];
  connectedDeviceIds?: string[];
  pairing: { code: string; token: string; expiresAt: number } | null;
  addresses?: string[];
  tailscale?: string;
  tailnetName?: string;
  lan?: string | null;
  hosts?: string[];
  endpoints?: CompanionEndpoint[];
  secretPublicKey?: string;
  discovery?: { advertising: boolean; name: string };
  error?: string;
}

export type CompanionBridge = {
  state: () => Promise<CompanionState>;
  start: () => Promise<CompanionState>;
  stop: () => Promise<CompanionState>;
  keepAwake: (enabled: boolean) => Promise<CompanionState>;
  refreshTailscale: () => Promise<CompanionState>;
  pairing: (open: boolean, expectedToken?: string) => Promise<CompanionState>;
  cloudDesktop: (deviceId: string, allowed: boolean) => Promise<CompanionState>;
  revoke: (deviceId: string) => Promise<CompanionState>;
};

type AccountBridge = NonNullable<NonNullable<Window["ogb"]>["companionAccount"]>;
type StateBridge<T> = { state: () => Promise<T> };
// functions, not constants: a message resolved at import time would keep the
// language the app booted in
const directPairingUnavailable = () => t("phone.error.directUnavailable");
const protectedPairingUnavailable = () => t("phone.error.protectedUnavailable");

interface OwnedCompanionPairingRoutePin extends CompanionPairingRoutePin {
  generation: number;
  token: string;
}

interface PhonePairingRequest {
  routeMode: CompanionPairingRouteMode;
  accountOverride?: CompanionAccountState | null;
  generation: number;
}

export const companionBridge = (): CompanionBridge | null =>
  // SAFETY: the preload owns this narrow bridge; browser builds are guarded by the optional lookup.
  (globalThis as { ogb?: { companion?: CompanionBridge } }).ogb?.companion ?? null;

export const companionAccountBridge = (): AccountBridge | null =>
  // SAFETY: Electron exposes only these account operations and never sends credentials to the renderer.
  (globalThis as { ogb?: { companionAccount?: AccountBridge } }).ogb?.companionAccount ?? null;

export const loadCompanionBridgeState = async (
  companion: StateBridge<CompanionState> | null,
  remote: StateBridge<CompanionAccountState> | null,
): Promise<{ companion: CompanionState | null; account: CompanionAccountState | null }> => {
  const [companionResult, accountResult] = await Promise.allSettled([
    companion ? Promise.resolve().then(() => companion.state()) : Promise.resolve(null),
    remote ? Promise.resolve().then(() => remote.state()) : Promise.resolve(null),
  ]);
  return {
    companion: companionResult.status === "fulfilled" ? companionResult.value : null,
    account: accountResult.status === "fulfilled" ? accountResult.value : null,
  };
};

export interface CompanionStateMutationEpoch {
  current: number;
}

/** Polls capture the epoch before reading. A mutation advances it both before
 * and after the IPC call, invalidating snapshots taken before or during that
 * mutation while leaving the independently loaded account result usable. */
export const mutateCompanionBridgeState = async <State,>(
  epoch: CompanionStateMutationEpoch,
  mutate: () => Promise<State>,
): Promise<State> => {
  epoch.current += 1;
  try {
    return await mutate();
  } finally {
    epoch.current += 1;
  }
};

export const companionStateRefreshIsCurrent = (
  epoch: CompanionStateMutationEpoch,
  refreshEpoch: number,
): boolean => epoch.current === refreshEpoch;

export const shouldHydrateCompanionEmail = (
  userEdited: boolean,
  account: CompanionAccountState,
): boolean => !userEdited && Boolean(account.email);

export const companionAccountActionError = (
  account: CompanionAccountState | null,
  actionError: string | null,
): string | null => {
  if (actionError) return actionError;
  return account?.status === "signed-out" ? account.message ?? null : null;
};

export const phonePairingManualCodeMode = (
  pairingOpen: boolean,
  pairingLink: string | null,
): "details" | "direct" | "hidden" => {
  if (!pairingOpen) return "hidden";
  return pairingLink ? "details" : "direct";
};

export interface PhoneSetupController {
  state: CompanionState | null;
  account: CompanionAccountState | null;
  phase: PhoneSetupPhase;
  email: string;
  code: string;
  codeSent: boolean;
  busy: boolean;
  accountBusy: boolean;
  error: string | null;
  accountError: string | null;
  pairingLink: string | null;
  secondsLeft: number;
  address: string | undefined;
  pairingPort: number;
  hostedReady: boolean;
  localFallback: boolean;
  tailscaleFallback: boolean;
  tailscaleAvailable: boolean;
  pairingExpired: boolean;
  setupTimedOut: boolean;
  setEmail: (email: string) => void;
  setCode: (code: string) => void;
  changeEmail: () => void;
  start: () => void;
  useLocal: () => void;
  useTailscale: () => void;
  refreshTailscale: () => void;
  requestCode: () => void;
  verifyCode: () => void;
  retryAccount: () => void;
  cancel: () => void;
  refreshCode: () => void;
  finish: () => void;
  skip: () => void;
  act: (call: (companion: CompanionBridge) => Promise<CompanionState>) => Promise<void>;
  accountAct: (call: (remote: AccountBridge) => Promise<CompanionAccountState>) => Promise<void>;
}

export function usePhoneSetupController(profileEmail = ""): PhoneSetupController {
  const [state, setState] = useState<CompanionState | null>(null);
  const [account, setAccount] = useState<CompanionAccountState | null>(null);
  const [email, setEmailState] = useState(profileEmail);
  const [code, setCodeState] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [setupTimedOut, setSetupTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [flow, dispatchFlow] = useReducer(phoneSetupReducer, initialPhoneSetupFlowState);
  const emailEdited = useRef(false);
  const pairingUiOwner = useRef<PhonePairingAttemptLock>({ generation: null });
  const pairingAttemptQueue = useRef<PhonePairingAttemptQueue<PhonePairingRequest>>({
    active: null,
    pending: null,
  });
  const runPairingAttemptRef = useRef<(request: PhonePairingRequest) => Promise<void>>(
    async () => {},
  );
  const pairingRoutePinRef = useRef<OwnedCompanionPairingRoutePin | null>(null);
  const [pairingRoutePinState, setPairingRoutePinState] =
    useState<OwnedCompanionPairingRoutePin | null>(null);
  const setupGeneration = useRef(0);
  const mounted = useRef(true);
  const companionMutationEpoch = useRef(0);
  const loadInFlight = useRef<Promise<void> | null>(null);

  const publishPairingRoutePin = useCallback((pin: OwnedCompanionPairingRoutePin | null) => {
    pairingRoutePinRef.current = pin;
    setPairingRoutePinState(pin);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setupGeneration.current += 1;
    };
  }, []);

  const load = useCallback((): Promise<void> => {
    if (loadInFlight.current) return loadInFlight.current;
    const refreshEpoch = companionMutationEpoch.current;
    const pending = (async () => {
      const next = await loadCompanionBridgeState(companionBridge(), companionAccountBridge());
      if (!mounted.current) return;
      if (
        next.companion
        && companionStateRefreshIsCurrent(companionMutationEpoch, refreshEpoch)
      ) {
        setState(next.companion);
      }
      if (next.account) {
        setAccount(next.account);
        if (shouldHydrateCompanionEmail(emailEdited.current, next.account)) {
          setEmailState(next.account.email ?? "");
        }
      }
    })().finally(() => {
      if (loadInFlight.current === pending) loadInFlight.current = null;
    });
    loadInFlight.current = pending;
    return pending;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!emailEdited.current && profileEmail) setEmailState(profileEmail);
  }, [profileEmail]);

  const act = useCallback(async (call: (companion: CompanionBridge) => Promise<CompanionState>) => {
    const companion = companionBridge();
    if (!companion) return;
    setActionBusy(true);
    setError(null);
    try {
      const next = await mutateCompanionBridgeState(
        companionMutationEpoch,
        () => call(companion),
      );
      if (mounted.current) setState(next);
    } catch (cause) {
      if (mounted.current) setError(
        normalizePhoneSetupActionError(
          cause,
          t("phone.error.remoteUpdate"),
        ),
      );
    } finally {
      if (mounted.current) setActionBusy(false);
    }
  }, []);

  const accountAct = useCallback(
    async (call: (remote: AccountBridge) => Promise<CompanionAccountState>) => {
      const remote = companionAccountBridge();
      if (!remote) return;
      setAccountBusy(true);
      setAccountError(null);
      try {
        const next = await mutateCompanionBridgeState(
          companionMutationEpoch,
          () => call(remote),
        );
        if (!mounted.current) return;
        setAccount(next);
        await load();
      } catch (cause) {
        if (mounted.current) setAccountError(normalizePhoneSetupActionError(
          cause,
          t("phone.error.secureUpdate"),
        ));
      } finally {
        if (mounted.current) setAccountBusy(false);
      }
    },
    [load],
  );

  const runPairingAttempt = useCallback(
    async ({ routeMode, accountOverride, generation }: PhonePairingRequest) => {
      const finishAttempt = () => {
        if (releasePhonePairingAttempt(pairingUiOwner.current, generation) && mounted.current) {
          setPairingBusy(false);
        }
        const next = completePhonePairingAttempt(pairingAttemptQueue.current, generation);
        if (next) void runPairingAttemptRef.current(next);
      };
      const isCurrent = () => mounted.current && setupGeneration.current === generation;
      if (!isCurrent()) {
        finishAttempt();
        return;
      }
      const companion = companionBridge();
      if (!companion) {
        if (mounted.current && setupGeneration.current === generation) {
          setError(t("phone.error.desktopOnly"));
        }
        finishAttempt();
        return;
      }
      const staleAttemptMayClose = () => {
        const activePin = pairingRoutePinRef.current;
        return !activePin || activePin.generation === generation;
      };
      const previousPin = pairingRoutePinRef.current;
      if (previousPin && previousPin.generation !== generation) {
        publishPairingRoutePin(null);
        setState((current) => current?.pairing?.token === previousPin.token
          ? { ...current, pairing: null }
          : current);
      }
      setError(null);
      try {
        const started = await preparePhonePairingRoute(
          routeMode,
          Boolean(state?.enabled),
          {
            read: () => companion.state(),
            start: () => mutateCompanionBridgeState(
              companionMutationEpoch,
              () => companion.start(),
            ),
            refreshTailscale: () => mutateCompanionBridgeState(
              companionMutationEpoch,
              () => companion.refreshTailscale(),
            ),
            shouldContinue: isCurrent,
          },
        );
        if (!isCurrent()) return;
        setState(started);
        const startFailure = companionStartFailure(started);
        if (startFailure) {
          setProvisioning(false);
          setError(startFailure);
          dispatchFlow({ type: "reset" });
          return;
        }
        const explicitRoute = routeMode !== "automatic";
        const gate = phonePairingGate(accountOverride ?? account, started, explicitRoute);
        if (gate !== "open") {
          setProvisioning(gate === "wait" || gate === "start");
          return;
        }
        if (explicitRoute && !companionPairingRoute(started, routeMode)) {
          setProvisioning(false);
          setError(routeMode === "tailscale"
            ? t("phone.error.tailscaleUnavailable")
            : directPairingUnavailable());
          dispatchFlow({ type: "reset" });
          return;
        }
        const paired = await keepPhonePairingIfCurrent(
          () => mutateCompanionBridgeState(
            companionMutationEpoch,
            () => companion.pairing(true),
          ),
          (opened) => closePhonePairingIfOwned(
            opened,
            () => companion.state(),
            () => mutateCompanionBridgeState(
              companionMutationEpoch,
              () => companion.pairing(false, opened.pairing?.token),
            ),
            staleAttemptMayClose,
          ),
          isCurrent,
        );
        if (!paired) return;

        const pairingWindow = paired.pairing;
        const pairingFailure = companionPairingOpenFailure(
          paired,
          started.pairing?.token ?? null,
        );
        const routePin = pairingFailure ? null : companionPairingRoutePin(paired, routeMode);
        if (pairingFailure || !routePin || !pairingWindow) {
          await closePhonePairingIfOwned(
            paired,
            () => companion.state(),
            () => mutateCompanionBridgeState(
              companionMutationEpoch,
              () => companion.pairing(false, paired.pairing?.token),
            ),
            isCurrent,
          );
          if (!isCurrent()) return;
          publishPairingRoutePin(null);
          setState({ ...paired, pairing: null });
          setProvisioning(false);
          setError(pairingFailure ?? (routeMode === "local"
            ? directPairingUnavailable()
            : routeMode === "tailscale"
              ? t("phone.error.tailscaleUnavailable")
              : protectedPairingUnavailable()));
          dispatchFlow({ type: "reset" });
          return;
        }
        publishPairingRoutePin({
          ...routePin,
          generation,
          token: pairingWindow.token,
        });
        setState(paired);
        setProvisioning(false);
        setSetupTimedOut(false);
        dispatchFlow({
          type: "pairing-opened",
          deviceIds: paired.devices.map((device) => device.id),
        });
      } catch (cause) {
        if (!isCurrent()) return;
        publishPairingRoutePin(null);
        setProvisioning(false);
        setError(normalizePhoneSetupActionError(
          cause,
          t("phone.error.pairingPrepare"),
        ));
        dispatchFlow({ type: "reset" });
      } finally {
        finishAttempt();
      }
    },
    [account, publishPairingRoutePin, state],
  );

  useLayoutEffect(() => {
    runPairingAttemptRef.current = runPairingAttempt;
  }, [runPairingAttempt]);

  const openPairing = useCallback((
    routeMode: CompanionPairingRouteMode,
    accountOverride?: CompanionAccountState | null,
    generation = setupGeneration.current,
  ) => {
    const request = { routeMode, accountOverride, generation };
    const decision = queuePhonePairingAttempt(pairingAttemptQueue.current, request);
    if (decision === "duplicate") return;
    claimPhonePairingAttempt(pairingUiOwner.current, generation);
    setPairingBusy(true);
    if (decision === "start") void runPairingAttemptRef.current(request);
  }, []);

  const start = useCallback(() => {
    const baseline = phoneSetupBaseline(state?.devices ?? null);
    if (!baseline) return;
    const generation = ++setupGeneration.current;
    dispatchFlow({ type: "start", deviceIds: baseline });
    setError(null);
    setAccountError(null);
    setSetupTimedOut(false);
    if (
      phonePairingGate(account, state, false) === "open"
      || (account?.available && (account.status === "ready" || account.status === "connecting"))
    ) {
      setProvisioning(true);
      void openPairing("automatic", account, generation);
    }
  }, [account, openPairing, state]);

  const useLocal = useCallback(() => {
    const baseline = phoneSetupBaseline(state?.devices ?? null);
    if (!baseline) return;
    if (!flow.active) {
      dispatchFlow({ type: "start", deviceIds: baseline });
    }
    const generation = ++setupGeneration.current;
    dispatchFlow({ type: "use-local" });
    setProvisioning(true);
    setSetupTimedOut(false);
    setAccountError(null);
    void openPairing("local", undefined, generation);
  }, [flow.active, openPairing, state?.devices]);

  const useTailscale = useCallback(() => {
    const baseline = phoneSetupBaseline(state?.devices ?? null);
    if (!baseline) return;
    if (!flow.active) {
      dispatchFlow({ type: "start", deviceIds: baseline });
    }
    const generation = ++setupGeneration.current;
    dispatchFlow({ type: "use-tailscale" });
    setProvisioning(true);
    setSetupTimedOut(false);
    setAccountError(null);
    void openPairing("tailscale", undefined, generation);
  }, [flow.active, openPairing, state?.devices]);

  const refreshTailscale = useCallback(() => {
    void act((companion) => companion.refreshTailscale());
  }, [act]);

  const requestCode = useCallback(() => {
    const remote = companionAccountBridge();
    const normalized = email.trim().toLowerCase();
    if (!remote || !normalized) return;
    const generation = setupGeneration.current;
    setAccountBusy(true);
    setAccountError(null);
    void remote
      .requestCode(normalized)
      .then((next) => {
        if (!mounted.current || setupGeneration.current !== generation) return;
        setAccount(next);
        setCodeSent(true);
      })
      .catch((cause: unknown) => {
        if (!mounted.current || setupGeneration.current !== generation) return;
        setAccountError(
          normalizePhoneSetupActionError(cause, t("phone.error.sendCode")),
        );
      })
      .finally(() => {
        if (mounted.current && setupGeneration.current === generation) setAccountBusy(false);
      });
  }, [email]);

  const verifyCode = useCallback(() => {
    const remote = companionAccountBridge();
    const normalized = email.trim().toLowerCase();
    if (!remote || code.length !== 8) return;
    const generation = setupGeneration.current;
    setAccountBusy(true);
    setProvisioning(true);
    setSetupTimedOut(false);
    setAccountError(null);
    void mutateCompanionBridgeState(
      companionMutationEpoch,
      () => remote.verifyCode(normalized, code),
    )
      .then(async (next) => {
        if (!mounted.current || setupGeneration.current !== generation) return;
        setAccount(next);
        setCodeState("");
        setCodeSent(false);
        await openPairing("automatic", next, generation);
      })
      .catch((cause: unknown) => {
        if (!mounted.current || setupGeneration.current !== generation) return;
        setProvisioning(false);
        setAccountError(
          normalizePhoneSetupActionError(cause, t("phone.error.verifyCode")),
        );
      })
      .finally(() => {
        if (mounted.current && setupGeneration.current === generation) setAccountBusy(false);
      });
  }, [code, email, openPairing]);

  const retryAccount = useCallback(() => {
    const remote = companionAccountBridge();
    if (!remote) return;
    const baseline = flow.active ? phoneSetupBaseline(state?.devices ?? null) : null;
    const generation = ++setupGeneration.current;
    if (baseline) dispatchFlow({ type: "start", deviceIds: baseline });
    setAccountBusy(true);
    setProvisioning(true);
    setSetupTimedOut(false);
    setAccountError(null);
    void mutateCompanionBridgeState(
      companionMutationEpoch,
      () => remote.retry(),
    )
      .then(async (next) => {
        if (!mounted.current || setupGeneration.current !== generation) return;
        setAccount(next);
        if (flow.active) await openPairing("automatic", next, generation);
        else {
          await load();
          if (mounted.current && setupGeneration.current === generation) setProvisioning(false);
        }
      })
      .catch((cause: unknown) => {
        if (!mounted.current || setupGeneration.current !== generation) return;
        setProvisioning(false);
        setAccountError(
          normalizePhoneSetupActionError(cause, t("phone.error.restore")),
        );
      })
      .finally(() => {
        if (mounted.current && setupGeneration.current === generation) setAccountBusy(false);
      });
  }, [flow.active, load, openPairing, state?.devices]);

  const phase = derivePhoneSetupPhase(flow, {
    accountStatus: account?.available ? account.status : "unavailable",
    accountBusy,
    provisioning,
    provisioningTimedOut: setupTimedOut,
    pairingOpen: Boolean(
      state?.pairing
      && pairingRoutePinState?.token === state.pairing.token,
    ),
  });

  useEffect(() => {
    if (
      !flow.active
      || flow.localFallback
      || flow.tailscaleFallback
      || !account
      || (account.available && account.status !== "signed-out" && account.status !== "error")
    ) {
      return;
    }
    setProvisioning(false);
  }, [account, flow.active, flow.localFallback, flow.tailscaleFallback]);

  useEffect(() => {
    if (!shouldArmPhoneSetupProvisioningTimeout(flow, {
      provisioning,
      provisioningTimedOut: setupTimedOut,
    })) return;
    const timer = window.setTimeout(() => {
      const timedOutGeneration = setupGeneration.current;
      setupGeneration.current += 1;
      invalidatePhonePairingAttempt(pairingAttemptQueue.current, timedOutGeneration);
      releasePhonePairingAttempt(pairingUiOwner.current, timedOutGeneration);
      setPairingBusy(false);
      setAccountBusy(false);
      setProvisioning(false);
      setSetupTimedOut(true);
    }, PHONE_SETUP_PROVISIONING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [flow, provisioning, setupTimedOut]);

  useEffect(() => {
    const pin = pairingRoutePinState;
    if (!pin || !state) return;
    if (!state.pairing) {
      publishPairingRoutePin(null);
      return;
    }

    const tokenMatches = state.pairing.token === pin.token;
    const routeAvailable = companionPairingRoutePinAvailable(state, pin);
    if (tokenMatches && routeAvailable) return;

    const companion = companionBridge();
    if (setupGeneration.current === pin.generation) setupGeneration.current += 1;
    invalidatePhonePairingAttempt(pairingAttemptQueue.current, pin.generation);
    releasePhonePairingAttempt(pairingUiOwner.current, pin.generation);
    setPairingBusy(false);
    publishPairingRoutePin(null);
    setState((current) => current ? { ...current, pairing: null } : current);
    setProvisioning(false);
    setSetupTimedOut(false);
    setError(tokenMatches
      ? protectedPairingUnavailable()
      : t("phone.error.codeChanged"));
    dispatchFlow({ type: "reset" });

    if (tokenMatches && companion) {
      void closePhonePairingIfOwned(
        state,
        () => companion.state(),
        () => mutateCompanionBridgeState(
          companionMutationEpoch,
          () => companion.pairing(false, state.pairing?.token),
        ),
        () => {
          const activePin = pairingRoutePinRef.current;
          return !activePin || activePin.generation === pin.generation;
        },
      );
    }
  }, [pairingRoutePinState, publishPairingRoutePin, state]);

  useEffect(() => {
    if (!state) return;
    const device = newlyPairedDeviceForFlow(flow, state.devices);
    if (device) dispatchFlow({ type: "paired", deviceName: device.name });
  }, [flow, state]);

  useEffect(() => {
    if (
      !flow.active ||
      flow.localFallback ||
      flow.tailscaleFallback ||
      flow.pairingAttempted ||
      setupTimedOut ||
      !state ||
      phonePairingGate(account, state, false) !== "open"
    ) {
      return;
    }
    void openPairing("automatic");
  }, [account, flow.active, flow.localFallback, flow.pairingAttempted, flow.tailscaleFallback, openPairing, setupTimedOut, state]);

  const shouldPoll = flow.active || Boolean(state?.pairing);
  useEffect(() => {
    return startNonOverlappingPhoneSetupPoll(
      () => {
        setNow(Date.now());
        return load();
      },
      shouldPoll ? 1_000 : 10_000,
    );
  }, [load, shouldPoll]);

  const pairingRouteMode: CompanionPairingRouteMode = flow.localFallback
    ? "local"
    : flow.tailscaleFallback
      ? "tailscale"
      : "automatic";
  const pairingRoute = useMemo(
    () => {
      if (!state) return null;
      if (state.pairing) {
        return pairingRoutePinState?.token === state.pairing.token
          ? pairingRoutePinState.route
          : null;
      }
      return companionPairingRoute(state, pairingRouteMode);
    },
    [pairingRouteMode, pairingRoutePinState, state],
  );
  const pairingLink = useMemo(() => {
    if (!state?.pairing || !pairingRoute) return null;
    return companionPairingLink({
      ...pairingRoute,
      code: state.pairing.code,
      token: state.pairing.token,
      name: state.discovery?.name,
      secretPublicKey: state.secretPublicKey,
    });
  }, [pairingRoute, state]);

  const cancel = useCallback(() => {
    const cancelledGeneration = setupGeneration.current;
    setupGeneration.current += 1;
    invalidatePhonePairingAttempt(pairingAttemptQueue.current, cancelledGeneration);
    releasePhonePairingAttempt(pairingUiOwner.current, cancelledGeneration);
    setPairingBusy(false);
    const snapshot = state;
    const companion = companionBridge();
    publishPairingRoutePin(null);
    setState((current) => current ? { ...current, pairing: null } : current);
    if (companion && snapshot?.pairing) {
      void closePhonePairingIfOwned(
        snapshot,
        () => companion.state(),
        () => mutateCompanionBridgeState(
          companionMutationEpoch,
          () => companion.pairing(false, snapshot.pairing?.token),
        ),
        () => pairingRoutePinRef.current === null,
      );
    }
    setProvisioning(false);
    setAccountBusy(false);
    setSetupTimedOut(false);
    setCodeSent(false);
    setCodeState("");
    dispatchFlow({ type: "reset" });
  }, [publishPairingRoutePin, state]);

  return {
    state,
    account,
    phase,
    email,
    code,
    codeSent,
    busy: actionBusy || pairingBusy,
    accountBusy,
    error,
    accountError,
    pairingLink,
    secondsLeft: state?.pairing
      ? Math.max(0, Math.round((state.pairing.expiresAt - now) / 1000))
      : 0,
    address: pairingRoute?.address,
    pairingPort: pairingRoute?.port ?? state?.port ?? 8810,
    hostedReady: Boolean(state?.endpoints?.some((endpoint) => endpoint.kind === "hosted")),
    localFallback: flow.localFallback,
    tailscaleFallback: flow.tailscaleFallback,
    tailscaleAvailable: Boolean(state && companionPairingRoute(state, "tailscale")),
    pairingExpired: flow.pairingAttempted && !state?.pairing,
    setupTimedOut,
    setEmail: (next) => {
      emailEdited.current = true;
      setEmailState(next);
    },
    setCode: (next) => setCodeState(next.replaceAll(/\D/g, "").slice(0, 8)),
    changeEmail: () => {
      setCodeState("");
      setCodeSent(false);
      setAccountError(null);
    },
    start,
    useLocal,
    useTailscale,
    refreshTailscale,
    requestCode,
    verifyCode,
    retryAccount,
    cancel,
    refreshCode: () => {
      const generation = ++setupGeneration.current;
      void openPairing(pairingRouteMode, undefined, generation);
    },
    finish: () => {
      const generation = setupGeneration.current;
      setupGeneration.current += 1;
      invalidatePhonePairingAttempt(pairingAttemptQueue.current, generation);
      releasePhonePairingAttempt(pairingUiOwner.current, generation);
      setPairingBusy(false);
      publishPairingRoutePin(null);
      setSetupTimedOut(false);
      dispatchFlow({ type: "reset" });
    },
    skip: () => {
      const generation = setupGeneration.current;
      setupGeneration.current += 1;
      invalidatePhonePairingAttempt(pairingAttemptQueue.current, generation);
      releasePhonePairingAttempt(pairingUiOwner.current, generation);
      setPairingBusy(false);
      publishPairingRoutePin(null);
      dispatchFlow({ type: "skip" });
    },
    act,
    accountAct,
  };
}

function ValuePoints() {
  const points: Array<{ Icon: typeof Smartphone; title: string; detail: string }> = [
    { Icon: Smartphone, title: t("phone.value.chats"), detail: t("phone.value.chatsDetail") },
    { Icon: Check, title: t("phone.value.approvals"), detail: t("phone.value.approvalsDetail") },
    { Icon: ShieldCheck, title: t("phone.value.private"), detail: t("phone.value.privateDetail") },
  ];
  return (
    <div className="mt-5 grid w-full gap-2 sm:grid-cols-3">
      {points.map(({ Icon, title, detail }) => (
        <div key={title} className="border border-hairline bg-card px-3 py-3 text-left">
          <Icon size={16} className="text-accent" />
          <div className="mt-2 text-[13px] font-medium text-ink">{title}</div>
          <div className="mt-0.5 text-[11.5px] leading-relaxed text-ink-secondary">{detail}</div>
        </div>
      ))}
    </div>
  );
}

export function PhoneSetupFlowView({
  controller,
  variant,
  onSkip,
  onComplete,
  compactHeader = false,
}: {
  controller: PhoneSetupController;
  variant: "settings" | "onboarding";
  onSkip?: () => void;
  onComplete?: () => void;
  /** The host already shows a title for this step (the welcome tour does),
   * so the intro drops its own icon and heading and keeps the detail. */
  compactHeader?: boolean;
}) {
  const c = controller;
  const actionError = companionAccountActionError(c.account, c.accountError);
  const canSubmitEmail = /^\S+@\S+\.\S+$/.test(c.email.trim());
  const manualCodeMode = phonePairingManualCodeMode(Boolean(c.state?.pairing), c.pairingLink);

  if (c.phase === "intro" && compactHeader) {
    const points: Array<{ Icon: typeof Smartphone; title: string; detail: string }> = [
      { Icon: Smartphone, title: t("phone.value.chats"), detail: t("phone.value.chatsDetail") },
      { Icon: Check, title: t("phone.value.approvals"), detail: t("phone.value.approvalsDetail") },
      { Icon: ShieldCheck, title: t("phone.value.private"), detail: t("phone.value.privateDetail") },
    ];
    return (
      <div className="flex flex-col">
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-secondary">{t("phone.intro.detail")}</p>
        <div className="mt-4 grid grid-cols-[200px_1fr] items-center gap-6">
          <PhonePreview />
          <ul className="flex flex-col gap-3.5">
            {points.map(({ Icon, title, detail }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center border border-hairline bg-raised text-accent">
                  <Icon size={14} />
                </span>
                <span>
                  <span className="block text-[13.5px] font-medium text-ink">{title}</span>
                  <span className="block text-[12px] leading-relaxed text-ink-secondary">{detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={c.start}
          disabled={!c.state || c.busy || c.accountBusy}
          className="mt-5 w-full"
        >
          {t("phone.intro.setUp")}
        </Button>
        {c.error && <p role="alert" className="mt-3 font-mono text-[11px] text-danger">{c.error}</p>}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            c.skip();
            onSkip?.();
          }}
          className="mt-3 self-center"
        >
          {t("phone.intro.notNow")}
        </Button>
        <p className="mt-1.5 self-center font-mono text-[11px] text-ink-secondary">{t("phone.intro.resume")}</p>
      </div>
    );
  }

  if (c.phase === "intro") {
    return (
      <div className={compactHeader ? "flex flex-col items-start" : "flex flex-col items-center text-center"}>
        {!compactHeader && (
          <>
            <div className="flex size-12 items-center justify-center border border-hairline bg-raised text-accent">
              <Smartphone size={24} />
            </div>
            <h2 className="mt-4 text-[18px] font-semibold text-ink">{t("phone.intro.title", { app: brand().name })}</h2>
          </>
        )}
        <p className={compactHeader ? "mt-1 text-[13.5px] leading-relaxed text-ink-secondary" : "mt-1.5 max-w-[460px] text-[13.5px] leading-relaxed text-ink-secondary"}>
          {t("phone.intro.detail")}
        </p>
        <ValuePoints />
        <Button
          variant="primary"
          size="md"
          onClick={c.start}
          disabled={!c.state || c.busy || c.accountBusy}
          className={compactHeader ? "mt-5 w-full" : "mt-5 w-full max-w-[320px]"}
        >
          {variant === "settings"
            ? c.state?.devices.length
              ? t("phone.intro.pairAnother")
              : t("phone.intro.pair")
            : t("phone.intro.setUp")}
        </Button>
        {c.error && <p role="alert" className="mt-3 max-w-[390px] font-mono text-[11px] text-danger">{c.error}</p>}
        {variant === "onboarding" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                c.skip();
                onSkip?.();
              }}
              className={compactHeader ? "mt-3 self-center" : "mt-2.5"}
            >
              {t("phone.intro.notNow")}
            </Button>
            <p className={compactHeader ? "mt-2 self-center font-mono text-[11px] text-ink-secondary" : "mt-2 font-mono text-[11px] text-ink-secondary"}>
              {t("phone.intro.resume")}
            </p>
          </>
        )}
      </div>
    );
  }

  if (c.phase === "sign-in") {
    const unavailable = !c.account?.available;
    const failed = c.account?.status === "error" || c.setupTimedOut;
    return (
      <div className="mx-auto flex w-full max-w-[430px] flex-col">
        <Button variant="ghost" size="xs" onClick={c.cancel} className="mb-4 flex w-fit items-center gap-1.5">
          <ArrowLeft size={13} /> {t("phone.back")}
        </Button>
        <div className="flex size-11 items-center justify-center border border-hairline bg-raised text-accent">
          <Mail size={20} />
        </div>
        <h2 className="mt-3 text-[18px] font-semibold text-ink">
          {unavailable || failed ? t("phone.signIn.attention") : t("phone.signIn.title")}
        </h2>
        <p
          role={c.setupTimedOut ? "alert" : undefined}
          className="mt-1 text-[13px] leading-relaxed text-ink-secondary"
        >
          {unavailable
            ? t("phone.signIn.unavailable")
            : c.setupTimedOut
              ? t("phone.signIn.timedOut")
            : failed
              ? c.account?.message ?? t("phone.signIn.failed")
              : t("phone.signIn.emailPrompt")}
        </p>

        {!unavailable && !failed && (
          <div className="mt-5 flex flex-col gap-3">
            <div>
              <FieldLabel htmlFor="phone-signin-email">{t("phone.signIn.email")}</FieldLabel>
              <Input
                id="phone-signin-email"
                autoFocus
                autoComplete="email"
                inputMode="email"
                value={c.email}
                disabled={c.accountBusy || c.codeSent}
                onChange={(event) => c.setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !c.codeSent && canSubmitEmail) c.requestCode();
                }}
                placeholder="you@example.com"
              />
            </div>
            {c.codeSent && (
              <div>
                <FieldLabel htmlFor="phone-signin-code">{t("phone.signIn.code")}</FieldLabel>
                <Input
                  id="phone-signin-code"
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  value={c.code}
                  disabled={c.accountBusy}
                  onChange={(event) => c.setCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && c.code.length === 8) c.verifyCode();
                  }}
                  placeholder="12345678"
                  className="font-mono text-[16px] tracking-[0.18em]"
                />
              </div>
            )}
            <Button
              variant="primary"
              size="md"
              disabled={c.accountBusy || (!c.codeSent && !canSubmitEmail) || (c.codeSent && c.code.length !== 8)}
              onClick={c.codeSent ? c.verifyCode : c.requestCode}
            >
              {c.accountBusy ? t("phone.signIn.working") : c.codeSent ? t("phone.signIn.verify") : t("phone.signIn.sendCode")}
            </Button>
            {c.codeSent && (
              <Button
                variant="ghost"
                size="sm"
                disabled={c.accountBusy}
                onClick={c.changeEmail}
              >
                {t("phone.signIn.otherEmail")}
              </Button>
            )}
            {c.codeSent && !actionError && (
              <p className="font-mono text-[11px] text-ink-secondary">{t("phone.signIn.expires")}</p>
            )}
          </div>
        )}

        {(unavailable || failed) && (
          <Button
            variant="primary"
            size="md"
            disabled={c.accountBusy}
            onClick={c.retryAccount}
            className="mt-5"
          >
            {c.accountBusy ? t("remote.account.retrying") : t("phone.signIn.retry")}
          </Button>
        )}
        {actionError && <p role="alert" className="mt-3 font-mono text-[11px] text-danger">{actionError}</p>}
        <div className="my-4 flex items-center gap-3 label-mono text-ink-secondary">
          <span className="h-px flex-1 bg-hairline" /> {t("phone.signIn.or")} <span className="h-px flex-1 bg-hairline" />
        </div>
        {variant === "onboarding" && c.tailscaleAvailable && (
          <>
            <Button
              variant="secondary"
              size="md"
              disabled={c.busy || c.accountBusy}
              onClick={c.useTailscale}
              className="w-full"
            >
              <ShieldCheck size={15} /> {t("remote.pairOverTailscale")}
            </Button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-secondary">
              {t("phone.signIn.tailnetNote")}
            </p>
          </>
        )}
        <Button
          variant="secondary"
          size="md"
          disabled={c.busy || c.accountBusy}
          onClick={c.useLocal}
          className={cn("w-full", variant === "onboarding" && c.tailscaleAvailable && "mt-3")}
        >
          <Wifi size={15} /> {t("phone.signIn.wifiInstead")}
        </Button>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-secondary">
          {t("phone.signIn.wifiNote")}
        </p>
      </div>
    );
  }

  if (c.phase === "verifying") {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="flex size-12 items-center justify-center border border-hairline bg-raised text-accent">
          <Loader2 size={24} className="animate-spin" />
        </div>
        <h2 className="mt-4 text-[18px] font-semibold text-ink">
          {c.localFallback
            ? t("phone.verifying.local")
            : c.tailscaleFallback
              ? t("phone.verifying.tailscale")
              : t("phone.verifying.secure")}
        </h2>
        <p className="mt-1.5 max-w-[360px] text-[13px] leading-relaxed text-ink-secondary">
          {c.localFallback
            ? t("phone.verifying.localDetail")
            : c.tailscaleFallback
              ? t("phone.verifying.tailscaleDetail")
            : t("phone.verifying.secureDetail")}
        </p>
        {(c.error || c.accountError) && (
          <p role="alert" className="mt-3 max-w-[380px] font-mono text-[11px] text-danger">{c.error ?? c.accountError}</p>
        )}
        <Button variant="ghost" size="sm" onClick={c.cancel} className="mt-5">{t("common.cancel")}</Button>
      </div>
    );
  }

  if (c.phase === "success") {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
          <Check size={28} />
        </div>
        <h2 className="mt-4 text-[19px] font-semibold text-ink">{t("phone.success.title")}</h2>
        <p className="mt-1.5 text-[13px] text-ink-secondary">
          {t("phone.success.detail")}
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            c.finish();
            onComplete?.();
          }}
          className="mt-5 w-full max-w-[280px]"
        >
          {variant === "onboarding" ? t("phone.success.start", { app: brand().name }) : t("phone.success.done")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex size-11 items-center justify-center border border-hairline bg-raised text-ink">
        <QrCode size={22} />
      </div>
      <h2 className="mt-3 text-[18px] font-semibold text-ink">
        {c.pairingExpired ? t("phone.code.expired") : t("phone.code.title")}
      </h2>
      <p className="mt-1 text-[13px] text-ink-secondary">
        {c.pairingExpired ? t("phone.code.expiredDetail") : t("phone.code.detail")}
      </p>
      {!c.pairingExpired && c.pairingLink && (
        <Frame surface="card" className="mt-4 bg-white p-3.5" aria-label={t("phone.code.qrAria")}>
          <QRCodeSVG value={c.pairingLink} size={180} level="M" bgColor="#ffffff" fgColor="#111111" />
        </Frame>
      )}
      {!c.pairingExpired && manualCodeMode === "direct" && c.state?.pairing && (
        <div className="mt-4 w-full max-w-[340px] border border-hairline bg-inset p-3 text-center">
          <div className="label-mono text-ink-secondary">{t("phone.code.manualIntro")}</div>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 font-mono">
            {c.state.pairing.code.split("").map((ch, i) =>
              ch === "-" ? (
                <span key={i} className="px-0.5 text-ink-secondary">-</span>
              ) : (
                <span
                  key={i}
                  className="inline-flex size-9 items-center justify-center border border-hairline bg-card text-[18px] font-semibold text-ink"
                >
                  {ch}
                </span>
              )
            )}
          </div>
        </div>
      )}
      {!c.pairingExpired && manualCodeMode === "details" && c.state?.pairing && (
        <p className="mt-3 font-mono text-[11px] text-ink-secondary">{t("phone.code.expiresIn", { seconds: c.secondsLeft })}</p>
      )}
      {c.pairingExpired && (
        <Button variant="primary" size="md" onClick={c.refreshCode} className="mt-5">
          {t("phone.code.createNew")}
        </Button>
      )}
      {!c.pairingExpired && c.state?.pairing && (
        <details className="mt-4 w-full max-w-[390px] border border-hairline p-3 text-left">
          <summary className="cursor-pointer font-mono text-[11px] text-ink-secondary hover:text-ink">{t("phone.code.trouble")}</summary>
          <div className="mt-3 text-[12px] text-ink-secondary">
            <div>{t("phone.code.manual")}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1 font-mono">
              {c.state.pairing.code.split("").map((ch, i) =>
                ch === "-" ? (
                  <span key={i} className="px-0.5 text-ink-secondary">-</span>
                ) : (
                  <span
                    key={i}
                    className="inline-flex size-7 items-center justify-center border border-hairline bg-inset text-[13px] font-semibold text-ink"
                  >
                    {ch}
                  </span>
                )
              )}
            </div>
            {c.address && (
              <div className="mt-3">
                <ConnectionDetail label={t("phone.code.address")} value={`${c.address}:${c.pairingPort}`} />
              </div>
            )}
          </div>
        </details>
      )}
      <Button variant="ghost" size="sm" onClick={c.cancel} className="mt-4">{t("common.cancel")}</Button>
    </div>
  );
}
export function PhoneSetupFlow({
  profileEmail,
  variant,
  onSkip,
  onComplete,
  compactHeader,
}: {
  profileEmail?: string;
  variant: "settings" | "onboarding";
  onSkip?: () => void;
  onComplete?: () => void;
  compactHeader?: boolean;
}) {
  const controller = usePhoneSetupController(profileEmail);
  return (
    <PhoneSetupFlowView
      controller={controller}
      variant={variant}
      onSkip={onSkip}
      onComplete={onComplete} compactHeader={compactHeader} />
  );
}

export { companionPairingMode };
