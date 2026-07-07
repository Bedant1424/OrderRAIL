import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import { supabase, formatMoney } from "@/lib/db";
import { toast } from "sonner";

export interface AppNotification {
  id: string;
  tableId: string;
  tableLabel: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  type: string;
  relatedId?: string;
  updateCount?: number;
}

interface NotificationCtx {
  notifications: AppNotification[];
  unreadCount: number;
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (notif: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
}

const Ctx = createContext<NotificationCtx | null>(null);

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("Failed to play synthesized sound:", e);
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const raw = localStorage.getItem("orderrail.staff.notifications");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem("orderrail.staff.sound");
      return raw ? raw === "true" : true;
    } catch {
      return true;
    }
  });

  const [tablesMap, setTablesMap] = useState<Record<string, string>>({});

  // Sync localStorage
  useEffect(() => {
    localStorage.setItem("orderrail.staff.notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem("orderrail.staff.sound", soundOn.toString());
  }, [soundOn]);

  // Load tables mapping
  useEffect(() => {
    const loadTables = async () => {
      const { data } = await supabase.from("tables").select("id, label");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((t) => {
          map[t.id] = t.label;
        });
        setTablesMap(map);
      }
    };
    void loadTables();
  }, []);

  const addNotification = (notif: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    const now = Date.now();
    let isGrouped = false;
    let targetNotifId = "";

    setNotifications((prev) => {
      const existingIdx = prev.findIndex(
        (n) => n.tableId === notif.tableId && !n.read && (now - n.timestamp < 300000)
      );

      if (existingIdx !== -1) {
        isGrouped = true;
        const existing = prev[existingIdx];
        targetNotifId = existing.id;
        const updateCount = (existing.updateCount || 1) + 1;
        const updated: AppNotification = {
          ...existing,
          title: `Table ${notif.tableLabel}`,
          description: `${updateCount} new updates`,
          timestamp: now,
          priority: notif.priority === "high" || existing.priority === "high" ? "high" : "medium",
          updateCount,
        };
        const next = [...prev];
        next[existingIdx] = updated;
        return next;
      } else {
        const id = Math.random().toString(36).substring(2, 9);
        targetNotifId = id;
        const newNotif: AppNotification = {
          ...notif,
          id,
          timestamp: now,
          read: false,
          updateCount: 1,
        };
        return [newNotif, ...prev];
      }
    });

    // Handle priority actions (toasts/sounds)
    if (notif.priority === "high") {
      if (soundOn) playNotificationSound();
      toast(notif.title, {
        description: `Table ${notif.tableLabel} - ${notif.description}`,
        duration: 5000,
        className: "border-destructive/30 bg-destructive/10 text-destructive-foreground font-semibold",
      });
    } else if (notif.priority === "medium") {
      toast(notif.title, {
        description: `Table ${notif.tableLabel} - ${notif.description}`,
        duration: 5000,
        className: "border-warning/30 bg-warning/10 text-warning-foreground font-medium",
      });
    }
  };

  // Setup Supabase Realtime listeners
  useEffect(() => {
    if (Object.keys(tablesMap).length === 0) return;

    // 1. Listen for new orders
    const ordersChannel = supabase
      .channel("realtime-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const ord = payload.new;
          const tableLabel = tablesMap[ord.table_id] || "?";
          addNotification({
            tableId: ord.table_id,
            tableLabel,
            priority: "high",
            title: "New Order",
            description: `Order total ${formatMoney(ord.total_cents)}`,
            type: "order_new",
            relatedId: ord.id,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const ord = payload.new;
          const oldOrd = payload.old;
          const tableLabel = tablesMap[ord.table_id] || "?";

          if (ord.status === "ready" && oldOrd.status !== "ready") {
            addNotification({
              tableId: ord.table_id,
              tableLabel,
              priority: "low",
              title: "Order Ready",
              description: `Order #${ord.id.slice(0, 6).toUpperCase()} is ready`,
              type: "order_ready",
              relatedId: ord.id,
            });
          } else if (ord.status === "served" && oldOrd.status !== "served") {
            addNotification({
              tableId: ord.table_id,
              tableLabel,
              priority: "low",
              title: "Order Served",
              description: `Order #${ord.id.slice(0, 6).toUpperCase()} was served`,
              type: "order_served",
              relatedId: ord.id,
            });
            // Automatically mark read related order_new notifications
            setNotifications((prev) =>
              prev.map((n) =>
                n.relatedId === ord.id ? { ...n, read: true } : n
              )
            );
          }
        }
      )
      .subscribe();

    // 2. Listen for service requests
    const srChannel = supabase
      .channel("realtime-sr")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "service_requests" },
        (payload) => {
          const sr = payload.new;
          const tableLabel = tablesMap[sr.table_id] || "?";
          const labelMap: Record<string, string> = {
            water: "Need Water",
            waiter: "Call Waiter",
            bill: "Need Bill",
            help: "Need Help",
          };
          addNotification({
            tableId: sr.table_id,
            tableLabel,
            priority: "medium",
            title: labelMap[sr.type] || "Service Request",
            description: `Requested by customer`,
            type: `sr_${sr.type}`,
            relatedId: sr.id,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "service_requests" },
        (payload) => {
          const sr = payload.new;
          if (sr.resolved_at) {
            // Automatically mark read related service request notifications
            setNotifications((prev) =>
              prev.map((n) =>
                n.relatedId === sr.id ? { ...n, read: true } : n
              )
            );
          }
        }
      )
      .subscribe();

    // 3. Listen for reviews
    const reviewsChannel = supabase
      .channel("realtime-reviews")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reviews" },
        (payload) => {
          const rev = payload.new;
          addNotification({
            tableId: "",
            tableLabel: "",
            priority: "low",
            title: "Review Submitted",
            description: `Rating: ${rev.rating}/5 stars`,
            type: "review",
            relatedId: rev.id,
          });
        }
      )
      .subscribe();

    // 4. Listen for table status updates (freed table)
    const tablesChannel = supabase
      .channel("realtime-tables-notif")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tables" },
        (payload) => {
          const tbl = payload.new;
          const oldTbl = payload.old;
          if (tbl.active_session_id === null && oldTbl.active_session_id !== null) {
            addNotification({
              tableId: tbl.id,
              tableLabel: tbl.label,
              priority: "low",
              title: "Table Free",
              description: `Table ${tbl.label} is now Free`,
              type: "table_free",
            });
            // Automatically mark all unread notifications for this table as read
            setNotifications((prev) =>
              prev.map((n) =>
                n.tableId === tbl.id ? { ...n, read: true } : n
              )
            );
          }
        }
      )
      .subscribe();

    // 5. Listen for customer order modifications (audits)
    const auditsChannel = supabase
      .channel("realtime-audits")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_audits" },
        async (payload) => {
          const aud = payload.new;
          if (aud.editor === "customer") {
            // Load table ID from order
            const { data: ord } = await supabase
              .from("orders")
              .select("table_id")
              .eq("id", aud.order_id)
              .maybeSingle();

            const tableId = ord?.table_id || "";
            const tableLabel = tablesMap[tableId] || "?";

            addNotification({
              tableId,
              tableLabel,
              priority: "high",
              title: aud.change_summary.toLowerCase().includes("remove")
                ? "Customer Cancelled Item"
                : "Customer Modified Order",
              description: aud.change_summary,
              type: "order_edit",
              relatedId: aud.order_id,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(srChannel);
      supabase.removeChannel(reviewsChannel);
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(auditsChannel);
    };
  }, [tablesMap]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const value = useMemo<NotificationCtx>(
    () => ({
      notifications,
      unreadCount,
      soundOn,
      setSoundOn,
      markRead,
      markAllRead,
      addNotification,
    }),
    [notifications, unreadCount, soundOn]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNotifications must be used inside NotificationProvider");
  return v;
}
