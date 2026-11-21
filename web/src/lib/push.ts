import { sendNotification, setVapidDetails } from "web-push";
import type { Contingency } from "./contingencies.ts";
import { db, tryWrite } from "./db.ts";
import type { Departamento } from "./departamentos.ts";

let ready = false;
function init() {
  if (ready) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  setVapidDetails(VAPID_SUBJECT ?? "mailto:alertas@superkid.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return (ready = true);
}

const DEDUPE_MS = 60 * 60_000; // same subscription, same zone, same contingency within 1 h → skip

export type PushPayload = {
  zone: Departamento;
  contingency: Contingency;
  message: string;
  title: string;
  body: string;
  url: string;
};

export type NotifyResult = { sent: number; reason?: "vapid" | "supabase" | "none" };

/** One path for every contingency. The payload is the zone, the type, and a short message. */
export async function notifyContingency(
  zone: Departamento,
  contingency: Contingency,
  message: string,
  opts: { replay?: boolean; force?: boolean; level?: number } = {},
): Promise<NotifyResult> {
  if (!init()) {
    console.error("[push] VAPID keys missing, skipping");
    return { sent: 0, reason: "vapid" };
  }

  let subs: { id: string; endpoint: string; p256dh: string; auth: string }[] | null = null;
  try {
    const { data, error } = await db().from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("departamento", zone);
    if (error) {
      console.error(`[push] ${error.message}`);
      return { sent: 0, reason: "supabase" };
    }
    subs = data;
  } catch (e) {
    console.error(`[push] ${(e as Error).message}`);
    return { sent: 0, reason: "supabase" };
  }
  if (!subs?.length) return { sent: 0, reason: "none" };

  const skip = new Set<string>();
  if (!opts.force) {
    const since = new Date(Date.now() - DEDUPE_MS).toISOString();
    const { data: recent, error } = await db()
      .from("notifications_log")
      .select("subscription_id")
      .eq("departamento", zone)
      .eq("contingency", contingency.code)
      .gte("sent_at", since);
    if (!error) for (const r of recent ?? []) skip.add(r.subscription_id);
  }

  const payload: PushPayload = {
    zone,
    contingency,
    message,
    title: `${opts.replay ? "[REPLAY] " : ""}${contingency.label} · ${zone}`,
    body: message,
    url: "/alerta",
  };
  const body = JSON.stringify(payload);
  let sent = 0;
  for (const s of subs) {
    if (skip.has(s.id)) continue;
    try {
      await sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 1800, urgency: (opts.level ?? 0) >= 4 ? "high" : "normal" },
      );
      sent++;
      const row = { subscription_id: s.id, departamento: zone, level: opts.level ?? 0, contingency: contingency.code };
      const logged = await db().from("notifications_log").insert(row);
      if (logged.error) await tryWrite("notifications_log", db().from("notifications_log").insert({ subscription_id: s.id, departamento: zone, level: opts.level ?? 0 }));
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await tryWrite("prune sub", db().from("push_subscriptions").delete().eq("id", s.id));
      else console.error(`[push] ${s.id}: ${(e as Error).message}`);
    }
  }
  return sent ? { sent } : { sent: 0, reason: "none" };
}
