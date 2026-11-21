// SuperKid service worker: push notifications only. No offline cache (stale weather is worse than none).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  const zone = d.zone || d.departamento || "x";
  const code = d.contingency && d.contingency.code || "alerta";
  const label = d.contingency && d.contingency.label;
  event.waitUntil(
    self.registration.showNotification(d.title || (label ? label + " · " + zone : "SuperKid"), {
      body: d.body || d.message || "",
      icon: "/icon",
      badge: "/icon",
      tag: "zona-" + zone + "-" + code,
      renotify: true,
      data: { url: d.url || "/alerta", zone: zone, contingency: d.contingency || null },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) { c.navigate(url); return c.focus(); }
      return self.clients.openWindow(url);
    }),
  );
});
