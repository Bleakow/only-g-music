/* Service worker de FCM (push en segundo plano). Vive en /public para servirse en
   la raíz (scope correcto). La config de Firebase llega por query params del
   registro (todo público NEXT_PUBLIC_*), porque el SW corre fuera del bundler.

   Mensajes DATA-only: construimos la notificación aquí (evita el doble-display que
   ocurriría con un payload `notification`). El texto es un "nudge"; el contenido
   real y traducido lo muestra la campanita al abrir la app. */
importScripts(
  "https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js",
);

const params = new URL(location).searchParams;
firebase.initializeApp({
  apiKey: params.get("apiKey"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || "Only G", {
    body: d.body || "",
    icon: "/logo/logo.png",
    badge: "/logo/logo.png",
    data: { link: d.link || "/" },
  });
});

// Click en la notificación → enfoca una pestaña existente en esa ruta o abre una.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link =
    (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url.includes(link) && "focus" in w) return w.focus();
        }
        return clients.openWindow(link);
      }),
  );
});
