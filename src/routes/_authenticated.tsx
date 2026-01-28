// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { isAuthenticated, clearAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw { redirect: { to: "/" } };
    }
  },
});

function AuthenticatedLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    clearAuthToken();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <img src="/app-logo.png" alt="" className="w-6 h-6 object-contain" />
          <span>Pickle Cats</span>
        </h1>
        <Button variant="ghost" size="icon-sm" onClick={handleLogout}>
          <LogOut className="size-4" />
        </Button>
      </header>
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
