import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { NavLink, Navigate, Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Coffee,
  ClipboardList,
  LogOut,
  Menu,
  QrCode,
  Settings,
  Star,
  UtensilsCrossed,
  Users,
  X,
  Bell,
  Volume2,
  Smartphone,
  Sparkles
} from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Overlay } from "@/components/ui/overlay";
import { useCafe } from "@/lib/cafe";
import { supabase, formatOrderLabel, type Order, type ServiceRequest } from "@/lib/db";
import { toast } from "sonner";
import { NotificationCenter, type NotificationItem } from "@/components/staff/NotificationCenter";
import {
  loadNotifications,
  saveNotifications,
  addNotification,
  dismissNotification,
  clearAllNotifications,
  markAllAsRead,
  getUnreadCount
} from "@/lib/notificationHistory";
import {
  loadNotificationSettings,
  saveNotificationSettings,
  getNotificationSetting,
  triggerNotification,
  initNotificationSystem
} from "@/lib/notificationSystem";
import { Switch } from "@/components/ui/switch";
import { AnchoredPopover } from "@/components/ui/AnchoredPopover";

export interface OwnerLayoutContextType {
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  unreadCount: number;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  notificationsTriggerRef: React.RefObject<HTMLButtonElement>;
  notificationsTriggerRefDesktop: React.RefObject<HTMLButtonElement>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  settingsTriggerRef: React.RefObject<HTMLButtonElement>;
  settingsTriggerRefDesktop: React.RefObject<HTMLButtonElement>;
  soundEnabled: boolean;
  handleSoundToggle: (val: boolean) => void;
  vibrationEnabled: boolean;
  handleVibrationToggle: (val: boolean) => void;
  flashCardsEnabled: boolean;
  handleFlashCardsToggle: (val: boolean) => void;
  handleClearAllNotifications: () => void;
}

export const OwnerLayoutContext = createContext<OwnerLayoutContextType | null>(null);

export function useOwnerLayout() {
  return useContext(OwnerLayoutContext);
}


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
  const navigate = useNavigate();

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Notification History states and refs
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsTriggerRef = useRef<HTMLButtonElement>(null);
  const notificationsTriggerRefDesktop = useRef<HTMLButtonElement>(null);

  // Settings states and refs
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsTriggerRefDesktop = useRef<HTMLButtonElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [flashCardsEnabled, setFlashCardsEnabled] = useState(true);

  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { cafe, cafeId } = useCafe();
  const unreadCount = getUnreadCount(notifications);

  useEffect(() => {
    initNotificationSystem();
    setNotifications(loadNotifications());
  }, []);

  useEffect(() => {
    if (isNotificationsOpen) {
      const readList = markAllAsRead();
      setNotifications(readList);
    }
  }, [isNotificationsOpen]);

  const handleSoundToggle = (val: boolean) => {
    setSoundEnabled(val);
    saveNotificationSettings({ sound: val });
  };
  const handleVibrationToggle = (val: boolean) => {
    setVibrationEnabled(val);
    saveNotificationSettings({ vibration: val });
  };
  const handleFlashCardsToggle = (val: boolean) => {
    setFlashCardsEnabled(val);
    saveNotificationSettings({ flashCards: val });
  };

  useEffect(() => {
    if (!cafeId) return;

    // Load initial settings
    const settings = loadNotificationSettings();
    setSoundEnabled(settings.sound);
    setVibrationEnabled(settings.vibration);
    setFlashCardsEnabled(settings.flashCards);

    // Guard: Prevent duplicate database subscriptions by using layout-level channel and cleanup handlers.
    // Distinct channel name `owner-global-${cafeId}` avoids conflict with other connections.
    const channel = supabase
      .channel(`owner-global-${cafeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newOrder = payload.new as Order;
          
          const isNewEvent = triggerNotification({
            type: "new",
            title: "New Order",
            body: `${formatOrderLabel(newOrder.order_number)} received.`,
            vibratePattern: 300,
            orderId: newOrder.id
          });

          if (isNewEvent) {
            void (async () => {
              const { data: tbl } = await supabase.from("tables").select("label").eq("id", newOrder.table_id).maybeSingle();
              
              const updatedList = addNotification(
                "new_order",
                "New Order",
                `Order ${formatOrderLabel(newOrder.order_number)} placed at Table ${tbl?.label ?? "?"}`,
                newOrder.id,
                "order"
              );
              setNotifications(updatedList);

              toast.success("🛒 New Order", {
                description: `${formatOrderLabel(newOrder.order_number)} has been placed.`,
                duration: 5000,
              });
            })();
          }
        } else if (payload.eventType === "UPDATE") {
          const newOrder = payload.new as Order;

          if (newOrder.status === "served") {
            void (async () => {
              const { data: tbl } = await supabase.from("tables").select("label").eq("id", newOrder.table_id).maybeSingle();
              const updatedList = addNotification(
                "completed_order",
                "Order Completed",
                `Order ${formatOrderLabel(newOrder.order_number)} for Table ${tbl?.label ?? "?"} completed.`,
                newOrder.id,
                "order"
              );
              setNotifications(updatedList);
            })();
          }
          
          if (newOrder.status === "cancelled" && newOrder.last_updated_by === "customer") {
            const isNewEvent = triggerNotification({
              type: "cancelled",
              title: "Order Cancelled",
              body: `${formatOrderLabel(newOrder.order_number)} was cancelled.`,
              vibratePattern: [150, 100, 150],
              orderId: newOrder.id
            });

            if (isNewEvent) {
              void (async () => {
                const { data: tbl } = await supabase.from("tables").select("label").eq("id", newOrder.table_id).maybeSingle();
                
                const updatedList = addNotification(
                  "cancelled_order",
                  "Order Cancelled",
                  `Order ${formatOrderLabel(newOrder.order_number)} for Table ${tbl?.label ?? "?"} was cancelled.`,
                  newOrder.id,
                  "order"
                );
                setNotifications(updatedList);

                toast.error("Order Cancelled", {
                  description: `Table ${tbl?.label ?? "?"} was CANCELLED by the customer.`,
                  duration: 5000,
                });
              })();
            }
          }
          else if (newOrder.status !== "cancelled" && newOrder.version > newOrder.last_reviewed_version && newOrder.last_updated_by === "customer") {
            const isNewEvent = triggerNotification({
              type: "updated",
              title: "Order Updated",
              body: `${formatOrderLabel(newOrder.order_number)} updated.`,
              vibratePattern: [120, 80, 120],
              orderId: newOrder.id
            });

            if (isNewEvent) {
              void (async () => {
                const { data: tbl } = await supabase.from("tables").select("label").eq("id", newOrder.table_id).maybeSingle();
                
                const updatedList = addNotification(
                  "updated_order",
                  "Order Updated",
                  `Order ${formatOrderLabel(newOrder.order_number)} for Table ${tbl?.label ?? "?"} was updated by customer.`,
                  newOrder.id,
                  "order"
                );
                setNotifications(updatedList);

                toast.info("Order Updated", {
                  description: `Table ${tbl?.label ?? "?"} updated by customer. Please review.`,
                  duration: 5000,
                });
              })();
            }
          }
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "service_requests", filter: `cafe_id=eq.${cafeId}` }, (payload) => {
        const req = payload.new as ServiceRequest;
        const t = req.type;
        const SR_META: Record<string, { label: string }> = {
          water: { label: "Water" },
          bill: { label: "Bill" },
          waiter: { label: "Call Waiter" },
        };
        const label = SR_META[t]?.label ?? t;
        
        const isNewEvent = triggerNotification({
          type: "sr",
          title: "Service Request",
          body: label,
          vibratePattern: [80, 60, 80, 60, 80],
          orderId: req.id
        });

        if (isNewEvent) {
          void (async () => {
            const { data: tbl } = await supabase.from("tables").select("label").eq("id", req.table_id).maybeSingle();
            const tableLabel = tbl ? `Table ${tbl.label}` : "Unknown table";

            let type: NotificationItem["type"] = "general_request";
            if (t === "water") type = "need_water";
            else if (t === "bill") type = "need_bill";
            else if (t === "waiter") type = "call_waiter";

            const updatedList = addNotification(
              type,
              type === "need_water" ? "Need Water" :
              type === "need_bill" ? "Need Bill" :
              type === "call_waiter" ? "Call Waiter" : "General Request",
              `Table ${tbl?.label ?? "?"} requested ${label.toLowerCase()}.`,
              req.id,
              "service_request"
            );
            setNotifications(updatedList);

            toast.warning(`Service Request: ${label}`, {
              description: `${tableLabel} is calling for attention.`,
              duration: 5000,
            });
          })();
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [cafeId]);

  const handleNotificationClick = (item: NotificationItem) => {
    setIsNotificationsOpen(false);
    
    // Mark as read when clicked
    const updated = loadNotifications().map(n => n.id === item.id ? { ...n, read: true } : n);
    saveNotifications(updated);
    setNotifications(updated);

    const doScrollAndFlash = () => {
      setTimeout(() => {
        if (item.relatedType === "order") {
          const el = document.getElementById(`order-card-${item.relatedId}`);
          if (el) {
            window.dispatchEvent(new CustomEvent("flash-card", { detail: { id: item.relatedId, type: item.type === "cancelled_order" ? "cancelled" : item.type === "updated_order" ? "updated" : "new" } }));
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } else if (item.relatedType === "service_request") {
          const el = document.getElementById(`sr-card-${item.relatedId}`);
          if (el) {
            const section = document.getElementById("service-requests-section");
            if (section) {
              section.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            const container = document.getElementById("service-requests-container");
            if (container) {
              el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }
            window.dispatchEvent(new CustomEvent("flash-card", { detail: { id: item.relatedId, type: "sr" } }));
          }
        }
      }, 500); // 500ms delay to let the page mount
    };

    if (location.pathname !== "/owner/orders") {
      navigate("/owner/orders");
      doScrollAndFlash();
    } else {
      doScrollAndFlash();
    }
  };

  const handleDismissNotification = (id: string) => {
    setNotifications(dismissNotification(id));
  };

  const handleClearAllNotifications = () => {
    setNotifications(clearAllNotifications());
  };

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
    <OwnerLayoutContext.Provider
      value={{
        notifications,
        setNotifications,
        unreadCount,
        isNotificationsOpen,
        setIsNotificationsOpen,
        notificationsTriggerRef,
        notificationsTriggerRefDesktop,
        isSettingsOpen,
        setIsSettingsOpen,
        settingsTriggerRef,
        settingsTriggerRefDesktop,
        soundEnabled,
        handleSoundToggle,
        vibrationEnabled,
        handleVibrationToggle,
        flashCardsEnabled,
        handleFlashCardsToggle,
        handleClearAllNotifications
      }}
    >
      <div className="min-h-screen bg-background flex flex-col print:block print:bg-white">
        {/* Global header bar (visible on mobile and tablet, hidden on desktop) */}
        <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur print:hidden shrink-0">
          <Link to="/owner" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-accent text-accent-foreground shadow-soft">
              <span className="font-display text-sm font-bold">OR</span>
            </span>
            <span className="font-display text-sm font-semibold">Owner</span>
          </Link>
          <div className="flex items-center gap-3">
            {/* Notification History Center */}
            <button
              ref={notificationsTriggerRef}
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition shadow-soft active:scale-95 shrink-0"
              aria-label="Notification center"
            >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-destructive text-[9.5px] font-bold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Settings Trigger */}
          <button
            ref={settingsTriggerRef}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition shadow-soft active:scale-95 shrink-0"
            aria-label="Notification settings"
          >
            <Settings className="h-5 w-5" />
          </button>

          {/* Hamburger Menu Trigger */}
          <button
            onClick={drawerOpen ? closeDrawer : openDrawer}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition shadow-soft active:scale-95 shrink-0"
            aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={drawerOpen}
          >
            {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Notification Center Popover */}
      <AnchoredPopover
        open={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        triggerRef={isDesktop ? notificationsTriggerRefDesktop : notificationsTriggerRef}
        className="w-[300px] max-w-[90vw]"
      >
        <NotificationCenter
          notifications={notifications}
          onClose={() => setIsNotificationsOpen(false)}
          onDismiss={handleDismissNotification}
          onClearAll={handleClearAllNotifications}
          onNotificationClick={handleNotificationClick}
        />
      </AnchoredPopover>

      {/* Settings Popover */}
      <AnchoredPopover
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        triggerRef={isDesktop ? settingsTriggerRefDesktop : settingsTriggerRef}
        className="w-[280px] max-w-[90vw]"
      >
        <div className="flex flex-col text-card-foreground">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 bg-muted/5">
            <h3 className="font-display text-sm font-semibold">Notification Settings</h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="grid h-6 w-6 place-items-center rounded-full bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground transition active:scale-95"
              aria-label="Close settings"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body/Rows */}
          <div className="p-1.5 space-y-0.5">
            {/* Sound Alerts */}
            <div
              onClick={() => handleSoundToggle(!soundEnabled)}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 transition duration-150 cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/8 text-blue-500">
                  <Volume2 className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-foreground">Sound Alerts</span>
              </div>
              <Switch
                id="notify-sound"
                checked={soundEnabled}
                onCheckedChange={handleSoundToggle}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Vibrate Alerts */}
            <div
              onClick={() => handleVibrationToggle(!vibrationEnabled)}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 transition duration-150 cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warning/8 text-warning">
                  <Smartphone className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-foreground">Vibrate Alerts</span>
              </div>
              <Switch
                id="notify-vibrate"
                checked={vibrationEnabled}
                onCheckedChange={handleVibrationToggle}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Flash Cards */}
            <div
              onClick={() => handleFlashCardsToggle(!flashCardsEnabled)}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 transition duration-150 cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/8 text-accent">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-foreground">Flash Cards</span>
              </div>
              <Switch
                id="notify-flash"
                checked={flashCardsEnabled}
                onCheckedChange={handleFlashCardsToggle}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      </AnchoredPopover>

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

      {/* Main layout column */}
      <div className="flex-1 lg:grid lg:grid-cols-[240px_1fr]">
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

        <main className="min-w-0 mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-10 print:p-0 print:max-w-none">
          <Outlet />
        </main>
      </div>
    </div>
    </OwnerLayoutContext.Provider>
  );
}
