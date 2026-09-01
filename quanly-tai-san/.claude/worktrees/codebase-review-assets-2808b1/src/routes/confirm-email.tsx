import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const searchSchema = z.object({ userId: z.string().optional(), token: z.string().optional() });

export const Route = createFileRoute("/confirm-email")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Xác thực email — Quản Lý Tài Sản" }] }),
  component: ConfirmEmailPage,
});

function ConfirmEmailPage() {
  const { userId, token } = useSearch({ from: "/confirm-email" });
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Đang xác thực email...");

  useEffect(() => {
    if (!userId || !token) {
      setState("error");
      setMessage("Liên kết không hợp lệ.");
      return;
    }
    (async () => {
      try {
        await api("/account/confirm-email", { method: "POST", body: { userId, token }, skipAuth: true });
        setState("ok");
        setMessage("Email đã được xác thực thành công.");
      } catch (err) {
        setState("error");
        setMessage(err instanceof ApiError ? err.detail : "Không xác thực được email.");
      }
    })();
  }, [userId, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Xác thực email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            {state === "loading" && <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />}
            {state === "ok" && <CheckCircle2 className="h-10 w-10 text-success" />}
            {state === "error" && <XCircle className="h-10 w-10 text-destructive" />}
          </div>
          <p className="text-sm">{message}</p>
          <div className="flex justify-center gap-3 text-sm">
            <Link to="/login" className="text-primary hover:underline">Về trang đăng nhập</Link>
            <Link to="/" className="text-primary hover:underline">Về trang chủ</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
