import { NavLink, Navigate, Outlet, Link } from "react-router-dom";
import { BarChart3, Coffee, ClipboardList, LogOut, Menu, QrCode, Settings, Star, UtensilsCrossed, Users } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

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
      {/* Sidebar */}
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
        <details className="relative">
          <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full bg-secondary">
            <Menu className="h-4 w-4" />
          </summary>
          <div className="absolute right-0 mt-2 w-56 space-y-1 rounded-2xl border border-border bg-popover p-2 shadow-float">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                    isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                  )
                }
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </NavLink>
            ))}
            <button
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </details>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-10 print:p-0 print:max-w-none">
        <Outlet />
      </main>
    </div>
  );
}
