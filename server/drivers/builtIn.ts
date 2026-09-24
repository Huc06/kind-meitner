// Built-in driver registration. The product ships Claude and Grok only.
import type { AnyProviderDriver } from "../contracts.ts";
import { ClaudeDriver } from "./claude.ts";
import { GrokDriver } from "./grok.ts";
import { GrokAgentDriver } from "./acp/grok.ts";

export const BUILT_IN_DRIVERS: readonly AnyProviderDriver[] = [
  GrokDriver,
  GrokAgentDriver,
  ClaudeDriver,
];
