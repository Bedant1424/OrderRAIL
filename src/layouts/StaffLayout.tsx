import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { LogOut, LayoutGrid } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth";

export default function StaffLayout({ require = "staff" as "staff" | "owner" }) {
  const { session, roles, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!session) {
    return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />;
  }
  const allowed = require === "owner" ? hasRole(roles, "owner") : hasRole(roles, "staff", "owner");
  if (!allowed) {
    return <Navigate to="/staff/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/staff" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-accent text-accent-foreground shadow-soft">
              <span className="font-display text-sm font-bold">OR</span>
            </span>
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">OrderRail</div>
              <div className="font-display text-sm font-semibold">Staff console</div>
            </div>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link
              to="/staff"
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground sm:inline-flex"
            >
              <LayoutGrid className="h-4 w-4" /> Dashboard
            </Link>
            <span className="hidden text-xs text-muted-foreground md:inline">{session.user.email}</span>
            <button
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
