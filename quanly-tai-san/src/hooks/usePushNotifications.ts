import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { pushApi } from "@/lib/api/push";
import { getErrorMessage } from "@/lib/api/errors";

// VAPID public key là base64url → PushManager cần Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const isSupported =
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window;

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const permissionDenied =
    typeof Notification !== "undefined" && Notification.permission === "denied";

  // Khôi phục trạng thái từ subscription hiện có của trình duyệt
  useEffect(() => {
    if (!isSupported) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch {
        /* ignore */
      }
    })();
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast.error("Trình duyệt này không hỗ trợ thông báo đẩy.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Bạn cần cho phép nhận thông báo để dùng tính năng này.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const { publicKey } = await pushApi.vapidPublicKey();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Không lấy được thông tin subscription từ trình duyệt.");
      }
      await pushApi.subscribe({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        deviceLabel: `${navigator.platform} — ${new Date().toLocaleDateString("vi-VN")}`,
      });

      setIsSubscribed(true);
      toast.success("Đã bật thông báo đẩy.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không bật được thông báo đẩy."));
    } finally {
      setBusy(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await pushApi.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
      toast.success("Đã tắt thông báo đẩy.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tắt được thông báo đẩy."));
    } finally {
      setBusy(false);
    }
  }, []);

  return { isSupported, isSubscribed, permissionDenied, busy, subscribe, unsubscribe };
}
