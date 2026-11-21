import { db } from "@/lib/db.ts";
import { isDepartamento } from "@/lib/departamentos.ts";

type Body = { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; departamento?: unknown };

export async function POST(req: Request) {
  const { subscription: s, departamento } = ((await req.json().catch(() => ({}))) ?? {}) as Body;
  const endpoint = s?.endpoint, p256dh = s?.keys?.p256dh, auth = s?.keys?.auth;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) return new Response("bad endpoint", { status: 400 });
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) return new Response("bad keys", { status: 400 });
  if (!isDepartamento(departamento)) return new Response("bad departamento", { status: 400 });
  const { error } = await db().from("push_subscriptions").upsert({ endpoint, p256dh, auth, departamento }, { onConflict: "endpoint" });
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { endpoint } = ((await req.json().catch(() => ({}))) ?? {}) as { endpoint?: unknown };
  if (typeof endpoint !== "string") return new Response("bad endpoint", { status: 400 });
  await db().from("push_subscriptions").delete().eq("endpoint", endpoint);
  return Response.json({ ok: true });
}
