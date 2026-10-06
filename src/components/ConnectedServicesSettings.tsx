import { useEffect, useState } from "react";
import { ExternalLink, CheckCircle2, XCircle, Activity } from "lucide-react";
import { BUILTIN_CONNECTED_SERVICES, type ConnectedService } from "../../shared/connected-services";
import { api, useStore } from "@/state/store";
import { Button } from "@/components/ui/button";
import { Card, SettingRow, Switch } from "./SettingsPrimitives";

export function ConnectedServicesSettings() {
  const { dispatch } = useStore();
  const [services, setServices] = useState<ConnectedService[]>(() => [...BUILTIN_CONNECTED_SERVICES]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let unmounted = false;
    api("/api/okx/connected-services")
      .then((data: { services?: ConnectedService[] }) => {
        if (!unmounted && Array.isArray(data?.services)) {
          setServices(data.services);
        }
      })
      .catch(() => {
        // Fall back to built-in list
      });
    return () => {
      unmounted = true;
    };
  }, []);

  const handleToggle = async (service: ConnectedService) => {
    if (togglingId) return;
    setTogglingId(service.id);
    const nextEnabled = !service.enabled;
    try {
      const res: { service?: ConnectedService } = await api(`/api/okx/connected-services/${service.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (res?.service) {
        setServices((prev) => prev.map((s) => (s.id === service.id ? res.service! : s)));
      } else {
        setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, enabled: nextEnabled } : s)));
      }
    } catch {
      // Keep prior state on error
    } finally {
      setTogglingId(null);
    }
  };

  const openDiagnostics = () => {
    dispatch({ type: "toggleAppSettings", open: false });
    const url = new URL(window.location.href);
    url.searchParams.set("view", "diagnostics");
    window.location.href = url.toString();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Connected Services"
        subtitle="Autonomous agents on okx.ai connected to Kind Meitner for direct MCP execution."
      >
        <div className="flex flex-col divide-y divide-hairline">
          {services.map((service) => (
            <div key={service.id} className="py-3.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[13px] text-ink">{service.name}</span>
                    <span className="font-mono text-[11px] text-ink-secondary">
                      okx.ai #{service.agentId}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-raised px-1.5 py-0.5 font-mono text-[10.5px] text-ink-secondary">
                      {service.price}
                    </span>
                    {service.enabled ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={12} /> Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-ink-secondary">
                        <XCircle size={12} /> Disabled
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                    {service.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px]">
                    <a
                      href={service.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-ink-secondary hover:text-ink"
                    >
                      <ExternalLink size={11} /> Source listing
                    </a>
                    <span className="text-ink-secondary/60">·</span>
                    <span className="text-ink-secondary">
                      Tools: {service.tools.map((t) => t.name).join(", ")}
                    </span>
                  </div>
                </div>
                <div className="pt-0.5">
                  <Switch
                    checked={service.enabled}
                    disabled={togglingId === service.id}
                    onClick={() => void handleToggle(service)}
                    aria-label={`Toggle ${service.name}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Diagnostics & Readiness"
        subtitle="Verification and trust diagnostics are available here. Check readiness for okx.ai agents and inspect certificates."
      >
        <SettingRow
          title="Service Diagnostics"
          subtitle="Open the diagnostic readiness console to inspect live endpoints and trust cards."
        >
          <Button variant="secondary" size="sm" onClick={openDiagnostics}>
            <Activity size={13} className="mr-1.5" />
            Open Diagnostics
          </Button>
        </SettingRow>
      </Card>
    </div>
  );
}
