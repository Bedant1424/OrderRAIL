import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { LogOut, LayoutGrid, Bell, Volume2, VolumeX, Trash2, CheckCircle, Clock, Coffee, Sparkles, AlertCircle, HelpCircle } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth";
import { useState } from "react";
import { NotificationProvider, useNotifications, type AppNotification } from "@/context/NotificationContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/db";
import { toast } from "sonner";

function StaffHeader({ onOpenNotifications }: { onOpenNotifications: () => void }) {
  const { session, signOut } = useAuth();
  const { unreadCount } = useNotifications();

  return (
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
        <div className="flex items-center gap-3 text-sm">
          <Link
            to="/staff"
            className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground sm:inline-flex"
          >
            <LayoutGrid className="h-4 w-4" /> Dashboard
          </Link>

          {/* Bell Icon with Badge */}
          <button
            onClick={onOpenNotifications}
            className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition"
            aria-label="Open notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid h-4.5 w-4.5 place-items-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-soft ring-2 ring-background">
                {unreadCount}
              </span>
            )}
          </button>

          <span className="hidden text-xs text-muted-foreground md:inline">{session?.user.email}</span>
          <button
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function NotificationsDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { notifications, soundOn, setSoundOn, markRead, markAllRead } = useNotifications();

  const handleAction = async (n: AppNotification) => {
    markRead(n.id);
    
    // Auto-resolve service request when clicked
    if (n.type.startsWith("sr_") && n.relatedId) {
      const { error } = await supabase
        .from("service_requests")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", n.relatedId);
      if (!error) {
        toast.success("Service request resolved");
      }
    }
  };

  const getIcon = (type: string, priority: string) => {
    if (type.startsWith("sr_")) return HandlPlatterIcon;
    if (type === "review") return StarIcon;
    if (priority === "high") return AlertCircle;
    if (type === "table_free") return Sparkles;
    return Coffee;
  };

  const StarIcon = (props: any) => (
    <span className="text-yellow-500 font-bold text-sm">★</span>
  );
  
  const HandlPlatterIcon = (props: any) => (
    <CheckCircle className="h-4 w-4 text-warning" />
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-xs"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-float"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="font-display text-lg font-bold">Notifications</h3>
                <button
                  onClick={markAllRead}
                  className="text-xs text-accent hover:underline font-semibold mt-0.5"
                >
                  Mark all read
                </button>
              </div>
              <div className="flex items-center gap-2">
                {/* Sound Toggle */}
                <button
                  onClick={() => setSoundOn(!soundOn)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition"
                  title={`Turn sound ${soundOn ? "OFF" : "ON"}`}
                >
                  {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button
                  onClick={onClose}
                  className="grid h-8 w-8 place-items-center rounded-full bg-secondary hover:bg-secondary/80 transition font-medium"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {notifications.map((n) => {
                const Icon = getIcon(n.type, n.priority);
                const isUnread = !n.read;
                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={cn(
                      "p-4 transition cursor-pointer flex gap-3.5",
                      isUnread ? "bg-accent/5" : "bg-card hover:bg-muted/10"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                        n.priority === "high"
                          ? "bg-destructive/15 text-destructive"
                          : n.priority === "medium"
                          ? "bg-warning/15 text-warning"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm font-semibold leading-none", isUnread && "text-foreground")}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                          {new Date(n.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-normal">
                        {n.description}
                      </p>
                      {/* Action buttons */}
                      <div className="pt-1.5 flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">
                          {n.tableLabel ? `Table ${n.tableLabel}` : "System"}
                        </span>
                        {isUnread && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAction(n);
                            }}
                            className={cn(
                              "rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide transition shadow-xs",
                              n.type.startsWith("sr_")
                                ? "bg-warning text-warning-foreground hover:bg-warning/90"
                                : "bg-accent text-accent-foreground hover:bg-accent/90"
                            )}
                          >
                            {n.type.startsWith("sr_") ? "Ack & Resolve" : "Mark Read"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {notifications.length === 0 && (
                <div className="flex h-64 flex-col items-center justify-center text-center p-6">
                  <Bell className="h-8 w-8 text-muted-foreground/45 mb-2 animate-bounce" />
                  <p className="text-sm font-semibold text-muted-foreground">You're all caught up!</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">New updates will appear here in real time.</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function StaffLayout({ require = "staff" as "staff" | "owner" }) {
  const { session, roles, loading } = useAuth();
  const location = useLocation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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
    <NotificationProvider>
      <div className="min-h-screen bg-background">
        <StaffHeader onOpenNotifications={() => setNotificationsOpen(true)} />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </main>
        <NotificationsDrawer isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      </div>
    </NotificationProvider>
  );
}
