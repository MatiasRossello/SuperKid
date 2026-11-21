// Client-safe: the model allowlist shown in the UI. The server only accepts ids from here.
export const MODELS = [
  { id: "nvidia/nemotron-3.5-super-vl", label: "Nemotron Super 3.5" },
  { id: "baidu/ernie-5.5-flash-preview:free", label: "ERNIE 5.5 Flash (preview, gratis)" },
  { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5 (referencia)" },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];
export const DEFAULT_MODEL: ModelId = MODELS[0].id;
export const isModel = (s: unknown): s is ModelId => MODELS.some((m) => m.id === s);
