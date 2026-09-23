import { Card } from "./SettingsPrimitives";

export function LocalComputerSection() {
  return (
    <Card title="This computer">
      <p className="text-[13px] leading-5 text-ink-secondary">
        Computer use runs on this computer only. Turn it on or off from a bot's Computer panel.
        Cloud computers, local VMs, and self-hosted VPS desktops are not available.
      </p>
    </Card>
  );
}
