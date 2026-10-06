export interface ConnectedServiceTool {
  name: string;
  title: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface ConnectedService {
  id: string;
  agentId: string;
  name: string;
  description: string;
  listingUrl: string;
  endpointUrl: string;
  price: string;
  enabled: boolean;
  provider: "okx.ai";
  tools: ConnectedServiceTool[];
}

export const BUILTIN_CONNECTED_SERVICES: readonly ConnectedService[] = [
  {
    id: "outdoorwindow",
    agentId: "6706",
    name: "OutdoorWindow",
    description: "Find safe outdoor time windows (air quality, heat index, UV, weather) over the next 48 hours.",
    listingUrl: "https://www.okx.ai/agents/6706",
    endpointUrl: "https://outdoorwindow.seriouss.workers.dev/mcp",
    price: "0 USDT (Free)",
    enabled: true,
    provider: "okx.ai",
    tools: [
      {
        name: "get_outdoor_windows",
        title: "Find safe outdoor time windows (next 48h)",
        description: "Returns ranked, concrete time windows over the next 48 hours when it is safest to be outdoors at a given location, for a given activity and duration.",
        inputSchema: {
          type: "object",
          properties: {
            place: { type: "string", description: "Free-text place name, e.g. 'Singapore', 'London'." },
            activity: {
              type: "string",
              enum: ["run", "walk", "cycle", "kids_playground", "outdoor_dining", "commute"],
              default: "walk",
            },
            duration_minutes: {
              type: "integer",
              minimum: 10,
              maximum: 480,
              default: 60,
            },
          },
          required: ["place"],
        },
      },
      {
        name: "check_outdoor_now",
        title: "Check outdoor conditions right now",
        description: "One-shot check of current outdoor conditions at a location: AQI, heat index, UV, wind, and precipitation verdict.",
        inputSchema: {
          type: "object",
          properties: {
            place: { type: "string", description: "Free-text place name, e.g. 'Singapore'." },
            activity: {
              type: "string",
              enum: ["run", "walk", "cycle", "kids_playground", "outdoor_dining", "commute"],
              default: "walk",
            },
          },
          required: ["place"],
        },
      },
    ],
  },
  {
    id: "plate",
    agentId: "6708",
    name: "Plate",
    description: "Typeset text into a finished, ready-to-post social image PNG card.",
    listingUrl: "https://www.okx.ai/agents/6708",
    endpointUrl: "https://plate.seriouss.workers.dev/mcp",
    price: "0 USDT (Free)",
    enabled: true,
    provider: "okx.ai",
    tools: [
      {
        name: "render_card",
        title: "Render a social card",
        description: "Typeset text into a finished, ready-to-post social image. Returns an SVG string and a stable, permanent PNG URL.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "The text to typeset on the social card." },
          },
          required: ["text"],
        },
      },
    ],
  },
];

export interface OutdoorWindowItem {
  rank?: number;
  start: string;
  end: string;
  score: number;
  verdict?: string;
  limiting_factor: string;
}

export function diffOutdoorWindows(
  prevWindows: readonly OutdoorWindowItem[] | undefined,
  currWindows: readonly OutdoorWindowItem[] | undefined,
): string {
  if (!prevWindows || prevWindows.length === 0 || !currWindows || currWindows.length === 0) {
    return "Initial run completed";
  }

  const prevBest = prevWindows[0];
  const currBest = currWindows[0];

  const timeChanged = prevBest.start !== currBest.start || prevBest.end !== currBest.end;
  const scoreChanged = prevBest.score !== currBest.score;
  const limiterChanged = prevBest.limiting_factor !== currBest.limiting_factor;

  if (!timeChanged && !scoreChanged && !limiterChanged) {
    return "No change since last run";
  }

  const changes: string[] = [];
  if (scoreChanged) {
    changes.push(`Suitability score: ${prevBest.score} → ${currBest.score}`);
  }
  if (timeChanged) {
    const prevStartFormatted = prevBest.start.slice(11, 16);
    const currStartFormatted = currBest.start.slice(11, 16);
    changes.push(`Best window shifted: ${prevStartFormatted} → ${currStartFormatted}`);
  }
  if (limiterChanged) {
    changes.push(`Limiting factor: ${currBest.limiting_factor}`);
  }

  return changes.join("; ");
}
export interface ParsedInputsResult {
  inputs: Record<string, unknown>;
  missingInputs: Array<{
    name: string;
    label: string;
    placeholder: string;
  }>;
}

export interface MatchOutcomeResult {
  matched: boolean;
  serviceId?: string;
  serviceName?: string;
  agentId?: string;
  toolName?: string;
  endpointUrl?: string;
  price?: string;
  matchReason: string;
  parsed: ParsedInputsResult;
}

const COMMON_CITIES = [
  "singapore", "new york", "london", "tokyo", "paris", "sydney", "berlin",
  "san francisco", "seattle", "chicago", "toronto", "seoul", "hong kong",
  "delhi", "mumbai", "shibuya tokyo", "brooklyn ny", "boston", "austin",
  "los angeles", "dubai", "shanghai", "beijing", "amsterdam", "madrid"
];

export function extractPlaceFromText(text: string): string | undefined {
  for (const city of COMMON_CITIES) {
    const regex = new RegExp(`\\b${city}\\b`, "i");
    if (regex.test(text)) {
      return city.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }

  const match = text.match(/\b(?:in|around|near|for|at)\s+([A-Za-z\s,]+?)(?:\s+(?:over|for|next|this|today|tomorrow|right|during)|\?|\.|$)/i);
  if (match?.[1]) {
    const candidate = match[1].trim();
    if (!/^(the|a|my|next|two|2|48|24|this|today|tomorrow|morning|evening|afternoon|days|hours|minutes)/i.test(candidate)) {
      return candidate.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }

  return undefined;
}

export function parseOutdoorInputs(text: string): ParsedInputsResult {
  const place = extractPlaceFromText(text);

  let activity = "walk";
  if (/\b(?:run|running|runner|jog|jogging)\b/i.test(text)) {
    activity = "run";
  } else if (/\b(?:cycle|cycling|cyclist|bike|biking)\b/i.test(text)) {
    activity = "cycle";
  } else if (/\b(?:playground|kids|children)\b/i.test(text)) {
    activity = "kids_playground";
  } else if (/\b(?:dining|eat|eating|dinner|lunch|patio)\b/i.test(text)) {
    activity = "outdoor_dining";
  } else if (/\b(?:commute|commuter|commuting)\b/i.test(text)) {
    activity = "commute";
  } else if (/\b(?:walk|walking|walker|hike|hiking)\b/i.test(text)) {
    activity = "walk";
  }

  let durationMinutes = 60;
  const minuteMatch = text.match(/(\d+)\s*(?:-| )(?:minute|min|m\b)/i);
  if (minuteMatch?.[1]) {
    const val = parseInt(minuteMatch[1], 10);
    if (!isNaN(val) && val >= 10 && val <= 480) {
      durationMinutes = val;
    }
  } else {
    const hourMatch = text.match(/(\d+)\s*(?:-| )(?:hour|hr|h\b)/i);
    if (hourMatch?.[1]) {
      const val = parseInt(hourMatch[1], 10) * 60;
      if (!isNaN(val) && val >= 10 && val <= 480) {
        durationMinutes = val;
      }
    }
  }

  const missingInputs: Array<{ name: string; label: string; placeholder: string }> = [];
  if (!place) {
    missingInputs.push({
      name: "place",
      label: "Location / Place",
      placeholder: "e.g. Singapore, London, Tokyo",
    });
  }

  return {
    inputs: {
      ...(place ? { place } : {}),
      activity,
      duration_minutes: durationMinutes,
    },
    missingInputs,
  };
}

export function parsePlateInputs(text: string): ParsedInputsResult {
  let clean = text
    .replace(/^.*?(?:render\s+(?:a\s+)?card|social\s+card|make\s+(?:a\s+)?card|create\s+(?:a\s+)?card|typeset)(?:\s+(?:for|with|text:))?\s*/i, "")
    .trim();

  if (!clean) {
    clean = text.trim();
  }

  const missingInputs: Array<{ name: string; label: string; placeholder: string }> = [];
  if (!clean) {
    missingInputs.push({
      name: "text",
      label: "Card Text",
      placeholder: "Enter the announcement or headline to typeset",
    });
  }

  return {
    inputs: clean ? { text: clean } : {},
    missingInputs,
  };
}

export function matchTaskToService(
  rawText: string,
  services: readonly ConnectedService[] = BUILTIN_CONNECTED_SERVICES,
): MatchOutcomeResult {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Check for OutdoorWindow match
  const outdoorMatches = /\b(?:outdoor|window|windows|run|running|walk|walking|cycle|cycling|bike|jog|jogging|air quality|aqi|heat index|uv index|safe outside|outside)\b/i.test(lower);
  if (outdoorMatches) {
    const outdoorService = services.find((s) => s.id === "outdoorwindow" && s.enabled);
    if (outdoorService) {
      const isRightNow = /\b(?:right now|currently|current conditions|is it ok right now|is it safe right now|weather now)\b/i.test(lower);
      const toolName = isRightNow ? "check_outdoor_now" : "get_outdoor_windows";
      const parsed = parseOutdoorInputs(text);
      const activityLabel = parsed.inputs.activity === "run" ? "a run" : parsed.inputs.activity === "cycle" ? "cycling" : "an outdoor activity";

      return {
        matched: true,
        serviceId: outdoorService.id,
        serviceName: outdoorService.name,
        agentId: outdoorService.agentId,
        toolName,
        endpointUrl: outdoorService.endpointUrl,
        price: outdoorService.price,
        matchReason: `Matched to OutdoorWindow (okx.ai #${outdoorService.agentId}) because your request asks for ${isRightNow ? "current outdoor safety conditions" : `the best time window for ${activityLabel}`}.`,
        parsed,
      };
    }
  }

  // 2. Check for Plate match
  const plateMatches = /\b(?:social card|render card|make a card|typeset card|plate|card image|text to image)\b/i.test(lower);
  if (plateMatches) {
    const plateService = services.find((s) => s.id === "plate" && s.enabled);
    if (plateService) {
      const parsed = parsePlateInputs(text);
      return {
        matched: true,
        serviceId: plateService.id,
        serviceName: plateService.name,
        agentId: plateService.agentId,
        toolName: "render_card",
        endpointUrl: plateService.endpointUrl,
        price: plateService.price,
        matchReason: `Matched to Plate (okx.ai #${plateService.agentId}) because your request asks to render a social card image.`,
        parsed,
      };
    }
  }

  // 3. No match
  return {
    matched: false,
    matchReason: "No connected service fits this task. Kind Meitner connects to OutdoorWindow (#6706) for outdoor planning and Plate (#6708) for social card generation. Try asking: \"When's the best time for a 45-minute run in Singapore over the next two days?\"",
    parsed: { inputs: {}, missingInputs: [] },
  };
}
