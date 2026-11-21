// Client-safe scenario metadata. A scenario runs on a virtual clock at SPEED x and never touches real data.
export const SCENARIO_SPEED = 10;

export const SCENARIOS = {
  replay: { label: "REPLAY 19/11", note: "DATOS GUARDADOS", start: "2026-11-19T19:00:00Z", end: "2026-11-19T23:58:00Z" },
  maipu: { label: "SIMULACIÓN MAIPÚ", note: "DATOS FICTICIOS", start: "2026-11-21T18:00:00Z", end: "2026-11-21T19:10:00Z" },
} as const;
export type ScenarioId = keyof typeof SCENARIOS;
export const isScenario = (s: unknown): s is ScenarioId => typeof s === "string" && s in SCENARIOS;
