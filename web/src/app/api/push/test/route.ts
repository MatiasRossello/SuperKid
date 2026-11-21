// Local only: fire one contingency push for a zone. Same send path as the live pipeline.
import { contingencyByCode, testMessage } from "@/lib/contingencies.ts";
import { isDepartamento } from "@/lib/departamentos.ts";
import { notifyContingency } from "@/lib/push.ts";

const REASONS = {
  vapid: "Faltan las claves VAPID en .env.local.",
  supabase: "Falta el proyecto Supabase (URL y service role) en .env.local.",
  none: "No hay navegadores suscriptos a esa zona.",
} as const;

export async function POST(req: Request) {
  const host = req.headers.get("host") ?? "";
  if (process.env.NODE_ENV === "production" || (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")))
    return new Response("not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { zone?: unknown; code?: unknown; message?: unknown };
  if (!isDepartamento(body.zone)) return new Response("bad zone", { status: 400 });
  const contingency = contingencyByCode(body.code);
  if (!contingency) return new Response("bad contingency", { status: 400 });

  const message = typeof body.message === "string" && body.message.trim()
    ? body.message.trim().slice(0, 180)
    : testMessage(contingency, body.zone);
  const result = await notifyContingency(body.zone, contingency, message, { force: true, level: 3 });
  return Response.json({
    ok: result.sent > 0,
    sent: result.sent,
    zone: body.zone,
    contingency,
    message,
    ...(result.reason ? { note: REASONS[result.reason] } : {}),
  }, { status: result.reason === "supabase" || result.reason === "vapid" ? 503 : 200 });
}
