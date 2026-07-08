import { useState, useCallback } from "react";
import { NavLink, Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { BarChart3, Coffee, ClipboardList, LogOut, Menu, QrCode, Settings, Star, UtensilsCrossed, Users, X } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Overlay } from "@/components/ui/overlay";

const nav = [
  { to: "/owner", end: true, label: "Analytics", icon: BarChart3 },
  { to: "/owner/orders", label: "Orders", icon: ClipboardList },
  { to: "/owner/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/owner/tables", label: "Tables & QR", icon: QrCode },
  { to: "/owner/staff", label: "Staff", icon: Users },
  { to: "/owner/reviews", label: "Reviews", icon: Star },
  { to: "/owner/settings", label: "Settings", icon: Settings },
];

export default function OwnerLayout() {
  const { session, roles, loading, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  console.log("OwnerLayout: Guard check evaluation:", {
    loading,
    sessionExists: !!session,
    roles,
    isOwner: hasRole(roles, "owner")
  });

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!session) {
    console.log("OwnerLayout: Redirecting to /staff/login - no session");
    return <Navigate to="/staff/login" replace />;
  }
  if (!hasRole(roles, "owner")) {
    console.log("OwnerLayout: Redirecting to /staff/login - not owner");
    return <Navigate to="/staff/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[240px_1fr] print:block print:bg-white">
      {/* Sidebar — desktop (unchanged) */}
      <aside className="hidden border-r border-border/60 bg-card/40 lg:flex lg:flex-col print:hidden">
        <Link to="/owner" className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-accent text-accent-foreground shadow-soft">
            <span className="font-display text-sm font-bold">OR</span>
          </span>
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">OrderRail</div>
            <div className="font-display text-sm font-semibold">Owner console</div>
          </div>
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border/60 p-3">
          <div className="mb-2 flex items-center gap-2 px-2 text-xs text-muted-foreground">
            <Coffee className="h-3.5 w-3.5" />
            <span className="truncate">{session.user.email}</span>
          </div>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur print:hidden">
        <Link to="/owner" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-accent text-accent-foreground shadow-soft">
            <span className="font-display text-sm font-bold">OR</span>
          </span>
          <span className="font-display text-sm font-semibold">Owner</span>
        </Link>
        <button
          onClick={drawerOpen ? closeDrawer : openDrawer}
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-secondary"
          aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={drawerOpen}
        >
          {drawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile navigation drawer — uses reusable Overlay */}
      <Overlay
        open={drawerOpen}
        onClose={closeDrawer}
        aria-label="Owner navigation"
        zClass="z-40"
      >
        <nav
          className={cn(
            "fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw]",
            "flex flex-col",
            "border-l border-border/60 bg-card shadow-float",
            "transition-transform duration-200 ease-out",
            drawerOpen ? "translate-x-0" : "translate-x-full",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-accent text-accent-foreground shadow-soft">
                <span className="font-display text-sm font-bold">OR</span>
              </span>
              <div className="leading-tight">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">OrderRail</div>
                <div className="font-display text-sm font-semibold">Navigation</div>
              </div>
            </div>
            <button
              onClick={closeDrawer}
              className="grid h-8 w-8 place-items-center rounded-full bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav items */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={closeDrawer}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-border/60 p-3">
            <div className="mb-2 flex items-center gap-2 px-2 text-xs text-muted-foreground">
              <Coffee className="h-3.5 w-3.5" />
              <span className="truncate">{session.user.email}</span>
            </div>
            <button
              onClick={() => { void signOut(); closeDrawer(); }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </nav>
      </Overlay>

      <main className="min-w-0 mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-10 print:p-0 print:max-w-none">
        <Outlet />
      </main>
    </div>
  );
}
