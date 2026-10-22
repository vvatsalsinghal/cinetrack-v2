import discoveryOptions from "./discoveryOptions.json" with { type: "json" };

export const DISCOVERY_MOODS = discoveryOptions.moods;
export const DISCOVERY_RUNTIME_OPTIONS = discoveryOptions.runtimeOptions;

export const MAX_DISCOVERY_PAGE = Math.ceil((20 * 500) / 12);

export function normalizeDiscoveryMood(value) {
  return typeof value === "string" && Object.hasOwn(DISCOVERY_MOODS, value)
    ? value
    : "";
}

export function normalizeDiscoveryRuntime(value) {
  return DISCOVERY_RUNTIME_OPTIONS.some((option) => option.value === value)
    ? value
    : "";
}
