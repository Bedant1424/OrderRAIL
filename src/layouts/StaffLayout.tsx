import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, LayoutGrid, Bell, Settings, Volume2, Smartphone, Sparkles, X, CheckSquare } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth";
import * as React from "react";
import { useState, useEffect, useRef, createContext, useContext } from "react";
import { useCafe } from "@/lib/cafe";
import { useImageUrl } from "@/lib/useImageUrl";
import { supabase, formatOrderLabel, type Order, type ServiceRequest } from "@/lib/db";
import { toast } from "@/components/ui/sonner";
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
  triggerNotification,
  initNotificationSystem
} from "@/lib/notificationSystem";
import { Switch } from "@/components/ui/switch";
import { AnchoredPopover } from "@/components/ui/AnchoredPopover";

import { useDemoMode } from "@/lib/permissions";

export interface StaffLayoutContextType {
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
  popupAlertsEnabled: boolean;
  handlePopupAlertsToggle: (val: boolean) => void;
  orderNotificationsEnabled: boolean;
  handleOrderNotificationsToggle: (val: boolean) => void;
  srNotificationsEnabled: boolean;
  handleSrNotificationsToggle: (val: boolean) => void;
  handleClearAllNotifications: () => void;
}

export const StaffLayoutContext = createContext<StaffLayoutContextType | null>(null);

export function useStaffLayout() {
  return useContext(StaffLayoutContext);
}

export default function StaffLayout({ require = "staff" as "staff" | "owner" }) {
  const { session, roles, loading, signOut } = useAuth();
  const isDemo = useDemoMode();
  const location = useLocation();
  const navigate = useNavigate();

  // Notification states
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsTriggerRef = useRef<HTMLButtonElement>(null);
  const notificationsTriggerRefDesktop = useRef<HTMLButtonElement>(null);

  // Settings states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsTriggerRefDesktop = useRef<HTMLButtonElement>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [flashCardsEnabled, setFlashCardsEnabled] = useState(true);
  const [popupAlertsEnabled, setPopupAlertsEnabled] = useState(true);
  const [orderNotificationsEnabled, setOrderNotificationsEnabled] = useState(true);
  const [srNotificationsEnabled, setSrNotificationsEnabled] = useState(true);

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
  const logoSrc = useImageUrl(cafe?.logo_url);
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
  const handlePopupAlertsToggle = (val: boolean) => {
    setPopupAlertsEnabled(val);
    saveNotificationSettings({ popupAlerts: val });
  };
  const handleOrderNotificationsToggle = (val: boolean) => {
    setOrderNotificationsEnabled(val);
    saveNotificationSettings({ orderNotifications: val });
  };
  const handleSrNotificationsToggle = (val: boolean) => {
    setSrNotificationsEnabled(val);
    saveNotificationSettings({ srNotifications: val });
  };

  useEffect(() => {
    if (!cafeId) return;

    // Load initial settings
    const settings = loadNotificationSettings();
    setSoundEnabled(settings.sound);
    setVibrationEnabled(settings.vibration);
    setFlashCardsEnabled(settings.flashCards);
    setPopupAlertsEnabled(settings.popupAlerts ?? true);
    setOrderNotificationsEnabled(settings.orderNotifications ?? true);
    setSrNotificationsEnabled(settings.srNotifications ?? true);

    // Guard: Prevent duplicate database subscriptions by using a single layout-level channel
    // and cleanup handlers. Distinct channel name `staff-global-${cafeId}` prevents clashing
    // with dashboard-level card flashing subscriptions.
    const channel = supabase
      .channel(`staff-global-${cafeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` }, (payload) => {
        const settingsLatest = loadNotificationSettings();
        if (!settingsLatest.orderNotifications) return;

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

              if (settingsLatest.popupAlerts) {
                toast.success("🛒 New Order", {
                  description: `${formatOrderLabel(newOrder.order_number)} has been placed.`,
                  duration: 5000,
                });
              }
            })();
          }
        } else if (payload.eventType === "UPDATE") {
          const newOrder = payload.new as Order;

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

                if (settingsLatest.popupAlerts) {
                  toast.error("Order Cancelled", {
                    description: `Table ${tbl?.label ?? "?"} was CANCELLED by the customer.`,
                    duration: 5000,
                  });
                }
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

                if (settingsLatest.popupAlerts) {
                  toast.info("Order Updated", {
                    description: `Table ${tbl?.label ?? "?"} updated by customer. Please review.`,
                    duration: 5000,
                  });
                }
              })();
            }
          }
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "service_requests", filter: `cafe_id=eq.${cafeId}` }, (payload) => {
        const settingsLatest = loadNotificationSettings();
        if (!settingsLatest.srNotifications) return;

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

            if (settingsLatest.popupAlerts) {
              toast.warning(`Service Request: ${label}`, {
                description: `${tableLabel} is calling for attention.`,
                duration: 5000,
              });
            }
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
          window.dispatchEvent(new CustomEvent("open-order-drawer", { detail: { orderId: item.relatedId } }));
          
          const el = document.getElementById(`order-card-${item.relatedId}`);
          if (el) {
            window.dispatchEvent(new CustomEvent("flash-card", { 
              detail: { 
                id: item.relatedId, 
                type: item.type === "cancelled_order" ? "cancelled" : item.type === "updated_order" ? "updated" : "new" 
              } 
            }));
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

    if (location.pathname !== "/staff") {
      navigate("/staff");
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

  const handleTestNotification = () => {
    triggerNotification({
      type: "new",
      title: "Test Alert",
      body: "Testing sound and notification systems.",
      vibratePattern: 200,
    });
    toast.success("🛒 Test Notification", {
      description: "Sound and popup are working!",
      duration: 3000,
    });
  };

  console.log("StaffLayout: Guard check evaluation:", {
    require,
    loading,
    sessionExists: !!session,
    roles,
    isOwner: hasRole(roles, "owner"),
    isStaff: hasRole(roles, "staff")
  });

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!session) {
    console.log("StaffLayout: Redirecting to /staff/login - no session");
    return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />;
  }
  const allowed = require === "owner" ? hasRole(roles, "owner") : hasRole(roles, "staff", "owner");
  if (!allowed) {
    console.log("StaffLayout: Redirecting to /staff/login - not allowed");
    return <Navigate to="/staff/login" replace />;
  }

  return (
    <StaffLayoutContext.Provider
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
        popupAlertsEnabled,
        handlePopupAlertsToggle,
        orderNotificationsEnabled,
        handleOrderNotificationsToggle,
        srNotificationsEnabled,
        handleSrNotificationsToggle,
        handleClearAllNotifications
      }}
    >
      <div className="min-h-screen bg-background">
        {isDemo && (
          <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 border-b border-amber-600/30 print:hidden select-none">
            <span>🧪 Public Demo</span>
            <span className="opacity-80">|</span>
            <span>Configuration changes are disabled. Explore freely.</span>
          </div>
        )}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <Link to="/staff" className="flex items-center gap-2">
              {logoSrc ? (
                <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-border shadow-soft bg-card shrink-0">
                  <img src={logoSrc} alt={cafe?.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-foreground shadow-soft shrink-0">
                  <span className="font-display text-sm font-bold">OR</span>
                </span>
              )}
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{cafe?.name ?? "OrderRail"}</div>
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

              {/* Mobile notification controls (visible below lg) */}
              <div className="flex lg:hidden items-center gap-1">
                <button
                  ref={notificationsTriggerRef}
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition shadow-soft active:scale-95 shrink-0"
                  aria-label="Notification center"
                >
                  <Bell className="h-4.5 w-4.5" />
                  {unreadCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 flex items-center justify-center bg-destructive text-destructive-foreground"
                      style={{
                        minWidth: "18px",
                        height: "18px",
                        borderRadius: "9999px",
                        fontSize: "10px",
                        fontWeight: 700,
                        lineHeight: 1,
                        paddingLeft: unreadCount >= 10 ? "5px" : "0px",
                        paddingRight: unreadCount >= 10 ? "5px" : "0px",
                      }}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                <button
                  ref={settingsTriggerRef}
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition shadow-soft active:scale-95 shrink-0"
                  aria-label="Notification settings"
                >
                  <Settings className="h-4.5 w-4.5" />
                </button>
              </div>

              <button
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
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

            {/* Settings list */}
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
                  id="staff-notify-sound"
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
                  id="staff-notify-vibrate"
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
                  id="staff-notify-flash"
                  checked={flashCardsEnabled}
                  onCheckedChange={handleFlashCardsToggle}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Popup Alerts */}
              <div
                onClick={() => handlePopupAlertsToggle(!popupAlertsEnabled)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 transition duration-150 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-success/8 text-success">
                    <Volume2 className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Popup Alerts</span>
                </div>
                <Switch
                  id="staff-notify-popups"
                  checked={popupAlertsEnabled}
                  onCheckedChange={handlePopupAlertsToggle}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Order Notifications */}
              <div
                onClick={() => handleOrderNotificationsToggle(!orderNotificationsEnabled)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 transition duration-150 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/8 text-blue-500">
                    <CheckSquare className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Orders</span>
                </div>
                <Switch
                  id="staff-notify-orders"
                  checked={orderNotificationsEnabled}
                  onCheckedChange={handleOrderNotificationsToggle}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Service Request Notifications */}
              <div
                onClick={() => handleSrNotificationsToggle(!srNotificationsEnabled)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 transition duration-150 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warning/8 text-warning">
                    <Bell className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Service Requests</span>
                </div>
                <Switch
                  id="staff-notify-sr"
                  checked={srNotificationsEnabled}
                  onCheckedChange={handleSrNotificationsToggle}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Manage Today's Specials */}
              {cafe?.staff_can_manage_specials && (
                <div className="pt-2 px-1">
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      if (location.pathname !== "/staff") {
                        navigate("/staff");
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent("open-specials-dialog"));
                        }, 500);
                      } else {
                        window.dispatchEvent(new CustomEvent("open-specials-dialog"));
                      }
                    }}
                    className="w-full rounded-xl bg-accent/10 border border-accent/20 py-2 text-xs font-semibold text-accent hover:bg-accent/20 transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="h-4 w-4" /> Manage Today's Specials
                  </button>
                </div>
              )}

              {/* Test Notification Button */}
              <div className="pt-2 px-1">
                <button
                  onClick={handleTestNotification}
                  className="w-full rounded-xl bg-primary/10 border border-primary/20 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition active:scale-95"
                >
                  Test Notification
                </button>
              </div>
            </div>
          </div>
        </AnchoredPopover>

        <main className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </StaffLayoutContext.Provider>
  );
}
