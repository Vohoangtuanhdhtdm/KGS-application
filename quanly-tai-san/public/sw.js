/* Service Worker xử lý Web Push cho Quản Lý Tài Sản */

self.addEventListener("push", (event) => {
  let data = { title: "Thông báo", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    data = { title: "Thông báo", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Thông báo", {
      body: data.body || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Mở app (hoặc focus tab đang mở) khi user bấm vào thông báo
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => "focus" in c);
      if (existing) return existing.focus();
      return clients.openWindow("/");
    }),
  );
});
