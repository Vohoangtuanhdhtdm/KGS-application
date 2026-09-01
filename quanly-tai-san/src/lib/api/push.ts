import { api, toQuery } from "./http";

export interface PushSubscribeInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceLabel?: string | null;
}

export const pushApi = {
  // AllowAnonymous phía backend — client vẫn gắn token nếu có, không sao
  vapidPublicKey: () => api<{ publicKey: string }>("/push/vapid-public-key"),
  subscribe: (body: PushSubscribeInput) => api<void>("/push/subscribe", { method: "POST", body }),
  unsubscribe: (endpoint: string) =>
    api<void>(`/push/subscribe${toQuery({ endpoint })}`, { method: "DELETE" }),
};
