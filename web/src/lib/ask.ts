// SuperKid answers a question with a model (OpenRouter), grounded only on the official facts of the departamento.
// Any failure, slow answer or invented number → the deterministic reply from chat.ts.
import { isModel, type ModelId } from "./models.ts";
import { inventedFacts } from "./summary.ts";

const CHAT_DEFAULT: ModelId = "baidu/ernie-5.5-flash-preview:free";

const SYSTEM = `Sos SuperKid, un pibe mendocino que contesta preguntas sobre el tiempo en su departamento.
Reglas:
- Respondé en 1 o 2 frases cortas (máximo 220 caracteres), en español rioplatense (vos), con onda pero sin exagerar.
- Usá SOLO los datos del JSON "datos". Si la pregunta pide algo que no está ahí, decí que no tenés ese dato. No pronostiques por tu cuenta ni inventes números, horas, lugares ni intensidades.
- Si los datos traen "aviso" de simulación, aclaralo.
- Si hay una alerta (nivel mayor a 0), mencionala primero con una acción concreta y razonable.
- Si la estación tiene "distancia_km", aclarás que es la más cercana y a cuántos km está.
- No menciones al SMN por nombre. No digas que sos una IA.
- Si la pregunta no tiene nada que ver con el tiempo, contestá con humor en una frase y volvé al tiempo.
- Devolvé solo el texto, sin comillas ni formato.`;

export type Asked = { text: string; model: string; error?: string };

export async function ask(question: string, facts: object, fallback: string): Promise<Asked> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { text: fallback, model: "reglas", error: "OPENROUTER_API_KEY no configurada" };
  const env = process.env.CHAT_MODEL;
  const model = isModel(env) ? env : CHAT_DEFAULT;
  const input = { pregunta: question, datos: facts };
  try {
    // The free ERNIE shares one upstream rate limit with everyone: on 429, one retry, then the rules answer.
    const call = () => fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "SuperKid" },
      body: JSON.stringify({
        model,
        max_tokens: 1500, // reasoning models spend part of it thinking
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(input) }],
      }),
    });
    let r = await call();
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 1500)); r = await call(); }
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
    const text = String(j.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!text) throw new Error(`respuesta vacía (${j.choices?.[0]?.finish_reason})`);
    const invented = inventedFacts(text, input);
    if (invented.length) throw new Error(`datos inventados: ${invented.join(", ")}`);
    return { text, model: String(j.model ?? model) };
  } catch (e) {
    console.error(`[ask] ${model}: ${(e as Error).message}`);
    return { text: fallback, model: "reglas", error: (e as Error).message };
  }
}
