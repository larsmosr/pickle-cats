// src/routes/_authenticated.tsx
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { isAuthenticated, logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  beforeLoad: async () => {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      throw { redirect: { to: "/" } };
    }
  },
});

function AuthenticatedLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center lg:py-8 lg:px-4">
      <div className="w-full max-w-2xl flex flex-col min-h-dvh lg:min-h-0 lg:rounded-xl lg:border lg:border-border lg:shadow-lg lg:bg-card lg:overflow-hidden">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between lg:bg-card/80">
          <Link to="/groups">
            <img
              src="/app-logo.png"
              alt="Pickle Cats"
              className="w-10 h-10 object-contain"
            />
          </Link>
          <Button variant="ghost" size="icon-sm" onClick={handleLogout}>
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="flex-1 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
