import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export const Route = createFileRoute("/nhu-cau")({
  head: () => ({ meta: [{ title: "Nhu cầu của tôi — KGS" }] }),
  component: () => (
    <ProtectedRoute>
      <MyDemandsPage />
    </ProtectedRoute>
  ),
});

function MyDemandsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nhu cầu của tôi</h1>
    </div>
  );
}
