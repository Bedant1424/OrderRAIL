import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, ChefHat, Clock, HandPlatter, Sparkles, X, Utensils, Droplet, Receipt, HelpCircle, Settings, Volume2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  supabase,
  formatMoney,
  formatOrderLabel,
  type Cafe,
  type Order,
  type OrderItem,
  type OrderStatus,
  type ServiceRequest,
  type TableRow,
} from "@/lib/db";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { NotificationCenter, type NotificationItem } from "@/components/staff/NotificationCenter";
import {
  loadNotifications,
  saveNotifications,
  addNotification,
  dismissNotification,
  clearAllNotifications,
  markAllAsRead,
  getUnreadCount,
} from "@/lib/notificationHistory";
import { Switch } from "@/components/ui/switch";
import {
  initNotificationSystem,
  triggerNotification,
  loadNotificationSettings,
  saveNotificationSettings,
  getNotificationSetting,
} from "@/lib/notificationSystem";

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: "preparing",
  preparing: "ready",
  ready: "served",
  served: null,
  cancelled: null,
};
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "Start preparing",
  preparing: "Mark ready",
  ready: "Mark served",
};

const SR_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  water: { label: "Needs water", icon: Droplet },
  waiter: { label: "Call waiter", icon: HandPlatter },
  bill: { label: "Requests bill", icon: Receipt },
  help: { label: "Needs help", icon: HelpCircle },
};

import { useCafe } from "@/lib/cafe";
import { AnchoredPopover } from "@/components/ui/AnchoredPopover";

type OrderWithItems = Order & { order_items: OrderItem[]; tables: { label: string } | null };
type TableWithSession = TableRow & { dining_sessions: { status: string } | null };

export default function StaffDashboardPage() {
  const qc = useQueryClient();
  const { cafe, cafeId } = useCafe();
  const [selectedTable, setSelectedTable] = useState<TableRow | null>(null);
  const [reviewingOrder, setReviewingOrder] = useState<OrderWithItems | null>(null);
  const [flashingIds, setFlashingIds] = useState<Record<string, "new" | "updated" | "sr" | "cancelled">>({});

  // Notification States
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [flashCardsEnabled, setFlashCardsEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);

  // Notification History states and refs
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsTriggerRef = useRef<HTMLButtonElement>(null);

  const unreadCount = getUnreadCount(notifications);

  useEffect(() => {
    setNotifications(loadNotifications());
  }, []);

  const handleNotificationClick = (item: NotificationItem) => {
    setIsNotificationsOpen(false);
    
    // Mark as read when clicked
    const updated = loadNotifications().map(n => n.id === item.id ? { ...n, read: true } : n);
    saveNotifications(updated);
    setNotifications(updated);

    if (item.relatedType === "order") {
      const el = document.getElementById(`order-card-${item.relatedId}`);
      if (el) {
        executeScroll(item.relatedId, () => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        
        // Flash card highlight
        const flashType = item.type === "cancelled_order" ? "cancelled" : item.type === "updated_order" ? "updated" : "new";
        setFlashingIds(prev => ({ ...prev, [item.relatedId]: flashType as any }));
        setTimeout(() => {
          setFlashingIds(prev => {
            const copy = { ...prev };
            delete copy[item.relatedId];
            return copy;
          });
        }, 2000);
      }
    } else if (item.relatedType === "service_request") {
      const el = document.getElementById(`sr-card-${item.relatedId}`);
      if (el) {
        // First scroll the requests section into center
        const section = document.getElementById("service-requests-section");
        if (section) {
          section.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        
        // Scroll horizontally to the card within container
        const container = document.getElementById("service-requests-container");
        if (container) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }

        // Trigger flash
        setFlashingIds(prev => ({ ...prev, [item.relatedId]: "sr" }));
        setTimeout(() => {
          setFlashingIds(prev => {
            const copy = { ...prev };
            delete copy[item.relatedId];
            return copy;
          });
        }, 2000);
      }
    }
  };

  const handleDismissNotification = (id: string) => {
    setNotifications(dismissNotification(id));
  };

  const handleClearAllNotifications = () => {
    setNotifications(clearAllNotifications());
  };



  // Idle Activity Detection
  const lastActivityRef = useRef(Date.now());
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const events = [
      "mousemove",
      "keydown",
      "keyup",
      "mousedown",
      "click",
      "scroll",
      "touchstart",
      "touchmove",
      "touchend",
      "focus",
      "visibilitychange"
    ];
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity));
    };
  }, []);

  const isIdle = () => {
    const idleTimeThresholdMs = 10000; // 10 seconds threshold
    return Date.now() - lastActivityRef.current >= idleTimeThresholdMs;
  };

  // Prevent duplicate scrolls tracker
  const lastScrolledIdRef = useRef<string | null>(null);
  const pendingScrollRequestIdRef = useRef<string | null>(null);
  const executeScroll = (id: string, runScroll: () => void) => {
    if (lastScrolledIdRef.current === id) return;
    lastScrolledIdRef.current = id;
    
    setTimeout(() => {
      if (lastScrolledIdRef.current === id) {
        lastScrolledIdRef.current = null;
      }
    }, 5000);

    runScroll();
  };

  useEffect(() => {
    initNotificationSystem();
    const settings = loadNotificationSettings();
    setSoundEnabled(settings.sound);
    setVibrationEnabled(settings.vibration);
    setFlashCardsEnabled(settings.flashCards);
  }, []);

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

  const handleAcknowledge = async (orderId: string, version: number) => {
    try {
      const { error } = await supabase.rpc("review_order_changes", {
        p_order_id: orderId,
        p_version: version,
      });
      if (error) throw error;
      toast.success("Changes acknowledged.");
      setReviewingOrder(null);
      void ordersQ.refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to acknowledge changes.");
    }
  };

  const ordersQ = useQuery({
    queryKey: ["staff-orders", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), tables(label)")
        .eq("cafe_id", cafeId!)
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;
      return (data ?? []) as unknown as OrderWithItems[];
    },
  });

  const srQ = useQuery({
    queryKey: ["staff-sr", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*, tables(label)")
        .eq("cafe_id", cafeId!)
        .in("status", ["open", "acknowledged"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (ServiceRequest & { tables: { label: string } | null })[];
    },
  });

  const tablesQ = useQuery({
    queryKey: ["staff-tables", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      // Clean up expired browsing sessions before loading table list
      await supabase.rpc("cleanup_expired_browsing_sessions");

      const { data } = await supabase
        .from("tables")
        .select("*, dining_sessions:active_session_id(*)")
        .eq("cafe_id", cafeId!)
        .order("label");
      
      const sorted = ((data ?? []) as any[]).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
      return sorted as TableWithSession[];
    },
  });

  // Realtime: refresh orders + service requests on any change for this cafe.
  useEffect(() => {
    if (!cafeId) return;
    const channel = supabase
      .channel(`staff-${cafeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` }, (payload) => {
        void qc.invalidateQueries({ queryKey: ["staff-orders", cafeId] });
        
        if (payload.eventType === "INSERT") {
          const newOrder = payload.new as Order;
          
          // Trigger notification via the queue
          const isNewEvent = triggerNotification({
            type: "new",
            title: "New Order",
            body: `${formatOrderLabel(newOrder.order_number)} received.`,
            vibratePattern: 300,
            orderId: newOrder.id
          });

          if (isNewEvent) {
            // Show toast notification
            void (async () => {
              const { data: tbl } = await supabase.from("tables").select("label").eq("id", newOrder.table_id).maybeSingle();
              const label = tbl ? `Table ${tbl.label}` : formatOrderLabel(newOrder.order_number);
              
              // Record history entry
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

            // Flash card green (pulse) if enabled
            if (getNotificationSetting("flashCards")) {
              setFlashingIds(prev => ({ ...prev, [newOrder.id]: "new" }));
              setTimeout(() => {
                setFlashingIds(prev => {
                  const copy = { ...prev };
                  delete copy[newOrder.id];
                  return copy;
                });
              }, 2000);
            }

            // Scroll if idle
            if (isIdle()) {
              setTimeout(() => {
                if (!isIdle()) return;
                const el = document.getElementById(`order-card-${newOrder.id}`);
                if (el) {
                  executeScroll(newOrder.id, () => {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  });
                }
              }, 1000);
            }
          }
        } else if (payload.eventType === "UPDATE") {
          const newOrder = payload.new as Order;

          // Record Order Completed if status changes to served
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
          
          // Case A: Cancelled by customer
          if (newOrder.status === 'cancelled' && newOrder.last_updated_by === 'customer') {
            const isNewEvent = triggerNotification({
              type: "cancelled",
              title: "Order Cancelled",
              body: `${formatOrderLabel(newOrder.order_number)} was cancelled.`,
              vibratePattern: [150, 100, 150],
              orderId: newOrder.id
            });

            if (isNewEvent) {
              // Show toast
              void (async () => {
                const { data: tbl } = await supabase.from("tables").select("label").eq("id", newOrder.table_id).maybeSingle();
                const label = tbl ? `Table ${tbl.label}` : formatOrderLabel(newOrder.order_number);
                
                // Record history entry
                const updatedList = addNotification(
                  "cancelled_order",
                  "Order Cancelled",
                  `Order ${formatOrderLabel(newOrder.order_number)} for Table ${tbl?.label ?? "?"} was cancelled.`,
                  newOrder.id,
                  "order"
                );
                setNotifications(updatedList);

                toast.error("Order Cancelled", {
                  description: `${label} was CANCELLED by the customer.`,
                  duration: 5000,
                });
              })();

              // Briefly highlight card as cancelled (red flash) for 2 seconds
              if (getNotificationSetting("flashCards")) {
                setFlashingIds(prev => ({ ...prev, [newOrder.id]: "cancelled" }));
                setTimeout(() => {
                  setFlashingIds(prev => {
                    const copy = { ...prev };
                    delete copy[newOrder.id];
                    return copy;
                  });
                }, 2000);
              }

              if (isIdle()) {
                // Scroll immediately to the current card location (before it moves)
                setTimeout(() => {
                  if (!isIdle()) return;
                  const el = document.getElementById(`order-card-${newOrder.id}`);
                  if (el) {
                    executeScroll(newOrder.id + "-cancel-pre", () => {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                    });
                  }
                }, 100);

                // Scroll again after transition to "Recently done" column
                setTimeout(() => {
                  if (!isIdle()) return;
                  const el = document.getElementById(`order-card-${newOrder.id}`);
                  if (el) {
                    executeScroll(newOrder.id + "-cancel-post", () => {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                    });
                  }
                }, 1200);
              }
            }
          }
          // Case B: Normal update by customer
          else if (newOrder.status !== 'cancelled' && newOrder.version > newOrder.last_reviewed_version && newOrder.last_updated_by === 'customer') {
            // Trigger notification
            const isNewEvent = triggerNotification({
              type: "updated",
              title: "Order Updated",
              body: `${formatOrderLabel(newOrder.order_number)} updated.`,
              vibratePattern: [120, 80, 120],
              orderId: newOrder.id
            });

            if (isNewEvent) {
              // Flash card if enabled
              if (getNotificationSetting("flashCards")) {
                setFlashingIds(prev => ({ ...prev, [newOrder.id]: "updated" }));
                setTimeout(() => {
                  setFlashingIds(prev => {
                    const copy = { ...prev };
                    delete copy[newOrder.id];
                    return copy;
                  });
                }, 2000);
              }

              void (async () => {
                const { data: tbl } = await supabase.from("tables").select("label").eq("id", newOrder.table_id).maybeSingle();
                const label = tbl ? `Table ${tbl.label}` : formatOrderLabel(newOrder.order_number);
                
                // Record history entry
                const updatedList = addNotification(
                  "updated_order",
                  "Order Updated",
                  `Order ${formatOrderLabel(newOrder.order_number)} for Table ${tbl?.label ?? "?"} was updated by customer.`,
                  newOrder.id,
                  "order"
                );
                setNotifications(updatedList);

                toast.info("Order Updated", {
                  description: `${label} updated by customer. Please review.`,
                  duration: 5000,
                });
              })();

              if (isIdle()) {
                setTimeout(() => {
                  if (!isIdle()) return;
                  const el = document.getElementById(`order-card-${newOrder.id}`);
                  if (el) {
                    executeScroll(newOrder.id, () => {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                    });
                  }
                }, 1000);
              }
            }
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        void qc.invalidateQueries({ queryKey: ["staff-orders", cafeId] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests", filter: `cafe_id=eq.${cafeId}` },
        (payload) => {
          void qc.invalidateQueries({ queryKey: ["staff-sr", cafeId] });
          if (payload.eventType === "INSERT") {
            const req = payload.new as ServiceRequest;
            const t = req.type;
            const label = SR_META[t]?.label ?? t;
            
            // Trigger notification
            const isNewEvent = triggerNotification({
              type: "sr",
              title: "Service Request",
              body: label,
              vibratePattern: [80, 60, 80, 60, 80],
              orderId: req.id
            });

            if (isNewEvent) {
              const triggerBlueFlash = (id: string) => {
                if (getNotificationSetting("flashCards")) {
                  setFlashingIds(prev => ({ ...prev, [id]: "sr" }));
                  setTimeout(() => {
                    setFlashingIds(prev => {
                      const copy = { ...prev };
                      delete copy[id];
                      return copy;
                    });
                  }, 2000);
                }
              };

              // Show toast immediately
              void (async () => {
                const { data: tbl } = await supabase.from("tables").select("label").eq("id", req.table_id).maybeSingle();
                const tableLabel = tbl ? `Table ${tbl.label}` : 'Unknown table';

                // Record history entry
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

              if (isIdle()) {
                // Set pending ID to scroll after React renders the new card in the DOM
                pendingScrollRequestIdRef.current = req.id;
              } else {
                // If active, flash card immediately without scrolling
                triggerBlueFlash(req.id);
              }
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables", filter: `cafe_id=eq.${cafeId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["staff-tables", cafeId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [cafeId, qc]);

  // Service Request Auto-Scroll Effect: Executes sequentially based on real-time DOM rendering events
  useEffect(() => {
    const pendingId = pendingScrollRequestIdRef.current;
    if (!pendingId) return;

    // Wait until the new service request card has been rendered into the DOM
    const cardEl = document.getElementById(`sr-card-${pendingId}`);
    if (!cardEl) return;

    // Clear target once found to prevent double scroll triggers on subsequent updates
    pendingScrollRequestIdRef.current = null;

    const triggerBlueFlash = (id: string) => {
      if (getNotificationSetting("flashCards")) {
        setFlashingIds(prev => ({ ...prev, [id]: "sr" }));
        setTimeout(() => {
          setFlashingIds(prev => {
            const copy = { ...prev };
            delete copy[id];
            return copy;
          });
        }, 2000);
      }
    };

    if (!isIdle()) {
      triggerBlueFlash(pendingId);
      return;
    }

    executeScroll(pendingId, () => {
      const section = document.getElementById("service-requests-section");
      if (!section) {
        triggerBlueFlash(pendingId);
        return;
      }

      // Event-driven vertical scroll helper
      const scrollToVertical = (targetEl: HTMLElement, callback: () => void) => {
        const rect = targetEl.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const isCentered = Math.abs((rect.top + rect.bottom) / 2 - viewportHeight / 2) < 15;

        if (isCentered) {
          callback();
          return;
        }

        let isDone = false;
        const done = () => {
          if (isDone) return;
          isDone = true;
          window.removeEventListener("scroll", handleScroll);
          window.removeEventListener("scrollend", handleScrollEnd);
          if (scrollTimeout) clearTimeout(scrollTimeout);
          callback();
        };

        let scrollTimeout: any = null;
        const handleScroll = () => {
          if (scrollTimeout) clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(done, 100);
        };

        const handleScrollEnd = () => {
          done();
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("scrollend", handleScrollEnd, { once: true });

        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        scrollTimeout = setTimeout(done, 1500); // safety fallback
      };

      // Event-driven horizontal scroll helper
      const scrollToHorizontal = (container: HTMLElement, targetEl: HTMLElement, callback: () => void) => {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const targetCenter = targetRect.left + targetRect.width / 2;
        const containerCenter = containerRect.left + containerRect.width / 2;
        const isCentered = Math.abs(targetCenter - containerCenter) < 15;

        if (isCentered) {
          callback();
          return;
        }

        let isDone = false;
        const done = () => {
          if (isDone) return;
          isDone = true;
          container.removeEventListener("scroll", handleScroll);
          container.removeEventListener("scrollend", handleScrollEnd);
          if (scrollTimeout) clearTimeout(scrollTimeout);
          callback();
        };

        let scrollTimeout: any = null;
        const handleScroll = () => {
          if (scrollTimeout) clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(done, 100);
        };

        const handleScrollEnd = () => {
          done();
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        container.addEventListener("scrollend", handleScrollEnd, { once: true });

        targetEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        scrollTimeout = setTimeout(done, 1500); // safety fallback
      };

      // Phase 1: Scroll Vertically
      scrollToVertical(section, () => {
        if (!isIdle()) {
          triggerBlueFlash(pendingId);
          return;
        }

        const container = document.getElementById("service-requests-container");
        if (!container) {
          triggerBlueFlash(pendingId);
          return;
        }

        // Phase 2: Scroll Horizontally
        scrollToHorizontal(container, cardEl, () => {
          // Phase 3: Blue flash animation
          triggerBlueFlash(pendingId);
        });
      });
    });
  }, [srQ.data]);

  const grouped = useMemo(() => {
    const orders = ordersQ.data ?? [];
    return {
      incoming: orders.filter((o) => o.status === "pending"),
      active: orders.filter((o) => o.status === "preparing" || o.status === "ready"),
      done: orders.filter((o) => o.status === "served" || o.status === "cancelled").slice(0, 20),
    };
  }, [ordersQ.data]);

  const advance = async (o: OrderWithItems) => {
    const next = NEXT_STATUS[o.status];
    if (!next) return;
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", o.id);
    if (error) toast.error(error.message);
  };

  const cancel = async (o: OrderWithItems) => {
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);
    if (error) toast.error(error.message);
  };

  const resolveSR = async (id: string) => {
    const { error } = await supabase.from("service_requests").update({ status: "resolved" }).eq("id", id);
    if (error) toast.error(error.message);
  };
  const ackSR = async (id: string) => {
    const { error } = await supabase.from("service_requests").update({ status: "acknowledged" }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const handleMarkTableFree = async (table: TableRow) => {
    try {
      const { error: rpcErr } = await supabase.rpc("free_table", {
        p_table_id: table.id,
      });

      if (rpcErr) throw rpcErr;

      toast.success(`Table ${table.label} marked Free`);
      void tablesQ.refetch();
      setSelectedTable(null);
    } catch (e: any) {
      console.error(e);
      const friendlyMsg = e.message?.includes("active orders")
        ? "This table still has active orders."
        : "Could not free table. Please try again.";
      toast.error(friendlyMsg);
    }
  };

  const currency = cafe?.currency ?? "USD";
  const openSRTables = new Set((srQ.data ?? []).map((s) => s.table_id));
  const occupiedTablesCount = (tablesQ.data ?? []).filter((t) => (t as any).dining_sessions?.status === "active").length;

  return (
    <div className="space-y-8">
      {/* Header and Settings/Bell Icons */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Manage active orders and service requests in real-time.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notification History Center */}
          <button
            ref={notificationsTriggerRef}
            onClick={() => {
              setIsNotificationsOpen(!isNotificationsOpen);
              // Mark all notifications as read when opening history
              if (!isNotificationsOpen) {
                const readList = markAllAsRead();
                setNotifications(readList);
              }
            }}
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
        </div>
      </div>

      {/* Notification Center Popover */}
      <AnchoredPopover
        open={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        triggerRef={notificationsTriggerRef}
        className="w-[320px] max-w-[90vw]"
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
        triggerRef={settingsTriggerRef}
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

      {/* Top stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Incoming" value={grouped.incoming.length} icon={Clock} tone="warning" />
        <StatCard label="In kitchen" value={grouped.active.length} icon={ChefHat} tone="accent" />
        <StatCard label="Open requests" value={srQ.data?.length ?? 0} icon={Bell} tone="destructive" />
        <StatCard label="Tables busy" value={occupiedTablesCount} icon={Utensils} tone="muted" />
      </section>

      {/* Service Requests — horizontal scroll strip.
           The page-level overflow root cause was <main> in OwnerLayout
           lacking min-width:0 as a grid item (confirmed via DevTools:
           htmlScrollW=1684 vs clientW=1019 WITHOUT min-width:0;
           htmlScrollW=clientW=1034 WITH min-width:0).
           The SR strip itself is correct: overflow-x:auto scrolls internally
           once its grid-item parent is properly constrained. */}
      {(srQ.data?.length ?? 0) > 0 && (
        <section id="service-requests-section">
          <h2 className="mb-3 font-display text-lg font-semibold">Service requests</h2>
          {/* horizontal-thin-scrollbar shows a thin custom scrollbar on desktop,
              and native overlay scrollbar on mobile.
              scroll-snap-type x mandatory + snap-start on cards gives
              the snapping behaviour. */}
          <div 
            id="service-requests-container" 
            className="horizontal-thin-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
          >
            <AnimatePresence initial={false}>
              {srQ.data!.map((s) => {
                const meta = SR_META[s.type] ?? { label: s.type, icon: Bell };
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={s.id}
                    id={`sr-card-${s.id}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "min-w-[280px] max-w-[320px] shrink-0 snap-center rounded-2xl border p-4 shadow-soft transition-all duration-300",
                      s.status === "open"
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-accent/40 bg-accent/5",
                      flashingIds[s.id] === "sr" && "animate-flash-blue"
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="h-4 w-4 shrink-0" /> {meta.label}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Table {s.tables?.label ?? "?"} · {new Date(s.created_at).toLocaleTimeString()}
                    </div>
                    {s.note && <p className="break-anywhere mt-2 text-xs">{s.note}</p>}
                    <div className="mt-3 flex gap-2">
                      {s.status === "open" && (
                        <button
                          onClick={() => void ackSR(s.id)}
                          className="rounded-full bg-secondary px-3 py-1 text-xs font-medium"
                        >
                          Ack
                        </button>
                      )}
                      <button
                        onClick={() => void resolveSR(s.id)}
                        className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                      >
                        Resolve
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Orders kanban — CSS Grid, each column min-width:0 to respect track width */}
      <section className="grid gap-4 lg:grid-cols-3">
        <OrderColumn
          title="Incoming"
          accent="warning"
          orders={grouped.incoming}
          currency={currency}
          onAdvance={advance}
          onCancel={cancel}
          onReviewChanges={setReviewingOrder}
          flashingIds={flashingIds}
          emptyLabel="No new orders."
        />
        <OrderColumn
          title="In progress"
          accent="accent"
          orders={grouped.active}
          currency={currency}
          onAdvance={advance}
          onCancel={cancel}
          onReviewChanges={setReviewingOrder}
          flashingIds={flashingIds}
          emptyLabel="Nothing in the kitchen right now."
        />
        <OrderColumn
          title="Recently done"
          accent="success"
          orders={grouped.done}
          currency={currency}
          onAdvance={advance}
          onReviewChanges={setReviewingOrder}
          flashingIds={flashingIds}
          emptyLabel="No completed orders yet."
        />
      </section>

      {/* Tables grid */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Tables</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {(tablesQ.data ?? []).map((t) => {
            const isOccupied = t.dining_sessions?.status === "active";
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTable(t)}
                className={cn(
                  "rounded-2xl border p-3 text-center shadow-soft cursor-pointer hover:border-primary/50 transition",
                  isOccupied
                    ? "border-accent/40 bg-accent/5"
                    : "border-border bg-card",
                )}
              >
                <div className="font-display text-lg font-semibold">{t.label}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {isOccupied ? "Occupied" : "Free"}
                </div>
              </div>
            );
          })}
        </div>

        <AnimatePresence>
          {selectedTable && (() => {
            const activeOrdersCount = (ordersQ.data ?? []).filter((o) =>
              o.dining_session_id === selectedTable.active_session_id &&
              (o.status === "pending" || o.status === "preparing" || o.status === "ready")
            ).length;
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-float"
                >
                  <h3 className="font-display text-xl font-bold">Table {selectedTable.label}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Current status: <span className="font-semibold text-foreground capitalize">{(selectedTable as any).dining_sessions?.status === "active" ? "Occupied" : "Free"}</span>
                  </p>
                  
                  <div className="mt-6 flex flex-col gap-2">
                    {(selectedTable as any).dining_sessions?.status === "active" ? (
                      <>
                        <button
                          disabled={activeOrdersCount > 0}
                          onClick={() => void handleMarkTableFree(selectedTable)}
                          className="w-full rounded-full bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Mark Table Free
                        </button>
                        {activeOrdersCount > 0 && (
                          <p className="mt-1 text-center text-xs text-destructive font-medium leading-normal">
                            {activeOrdersCount === 1 ? "1 active order remaining." : `${activeOrdersCount} active orders remaining.`} Complete all active orders before freeing this table.
                          </p>
                        )}
                      </>
                    ) : (
                      <button
                        disabled
                        className="w-full rounded-full bg-secondary py-2.5 text-sm font-semibold text-muted-foreground opacity-50 cursor-not-allowed"
                      >
                        Table is already Free
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedTable(null)}
                      className="w-full rounded-full bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>
      </section>

      {/* Review Changes Dialog */}
      <Dialog open={!!reviewingOrder} onOpenChange={(open) => !open && setReviewingOrder(null)}>
        {reviewingOrder && (() => {
          const diff = getOrderDiff(reviewingOrder.previous_items, reviewingOrder.order_items);
          return (
            <DialogContent className="sm:max-w-[425px] rounded-3xl">
              <DialogHeader>
                <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
                  <Bell className="h-5 w-5 text-accent animate-pulse" />
                  Review Changes
                </DialogTitle>
                <DialogDescription>
                  Table {reviewingOrder.tables?.label ?? "?"} · {formatOrderLabel(reviewingOrder.order_number)} has been updated.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-3">
                  <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Changes Diff</h4>
                  
                  {diff.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No item quantity changes (only notes updated).</p>
                  ) : (
                    <ul className="space-y-2">
                      {diff.map((item, idx) => {
                        const isAdded = item.qtyDiff > 0;
                        return (
                          <li
                            key={idx}
                            className={cn(
                              "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium border",
                              isAdded
                                ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
                                : "bg-destructive/10 border-destructive/20 text-destructive"
                            )}
                          >
                            <span>{item.name}</span>
                            <span className="tabular-nums">
                              {isAdded ? `+${item.qtyDiff}` : item.qtyDiff} (Now: {item.currQty})
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {reviewingOrder.note && (
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
                    <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Note for Staff</h4>
                    <p className="text-sm text-foreground italic">"{reviewingOrder.note}"</p>
                  </div>
                )}

                <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                  <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Current Order Items</h4>
                  <ul className="space-y-1 text-sm text-foreground divide-y divide-border/40">
                    {reviewingOrder.order_items?.map((it) => (
                      <li key={it.id} className="flex justify-between py-1.5">
                        <span>{it.qty}× {it.name}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {formatMoney(it.price_cents * it.qty, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between pt-2 border-t border-border/60 text-sm font-semibold">
                    <span>Total Amount</span>
                    <span className="tabular-nums">{formatMoney(reviewingOrder.total_cents, currency)}</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <button
                  onClick={() => setReviewingOrder(null)}
                  className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => void handleAcknowledge(reviewingOrder.id, reviewingOrder.version)}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/95 shadow-soft transition"
                >
                  Acknowledge Changes
                </button>
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "warning" | "accent" | "destructive" | "muted";
}) {
  const toneMap = {
    warning: "bg-warning/15 text-foreground",
    accent: "bg-accent/15 text-foreground",
    destructive: "bg-destructive/15 text-foreground",
    muted: "bg-secondary text-foreground",
  } as const;
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function OrderColumn({
  title,
  accent,
  orders,
  currency,
  onAdvance,
  onCancel,
  emptyLabel,
  onReviewChanges,
  flashingIds,
}: {
  title: string;
  accent: "warning" | "accent" | "success";
  orders: OrderWithItems[];
  currency: string;
  onAdvance: (o: OrderWithItems) => void;
  onCancel?: (o: OrderWithItems) => void;
  emptyLabel: string;
  onReviewChanges?: (o: OrderWithItems) => void;
  flashingIds: Record<string, "new" | "updated" | "sr" | "cancelled">;
}) {
  const dot = { warning: "bg-warning", accent: "bg-accent", success: "bg-success" }[accent];
  return (
    /*
     * kanban-col  → min-width: 0  (must-have so CSS Grid track constrains the column)
     * flex-col    → header stays fixed, card list scrolls
     * No max-h on wrapper → empty columns use natural height (min-height on scroll area)
     */
    <div className="kanban-col flex flex-col rounded-3xl bg-muted/40 p-3 ring-1 ring-border/50">
      {/* Column header — never scrolls */}
      <div className="mb-3 flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          <h3 className="font-display text-base font-semibold">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{orders.length}</span>
      </div>

      {/*
       * Card list:
       *   - kanban-scroll     → thin custom scrollbar, overflow-y:auto, overflow-x:hidden
       *   - max-h-[520px]     → caps the scrolling area height (not the whole column)
       *   - min-h-[80px]      → empty columns show a sensible height instead of collapsing
       * This is the ONLY element that scrolls vertically; horizontal scroll is impossible.
              */}
      <div className="kanban-scroll max-h-[520px] min-h-[80px] space-y-3 pr-1 py-1">
        <AnimatePresence initial={false}>
          {orders.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
              {emptyLabel}
            </p>
          )}
          {orders.map((o) => (
            <motion.article
              key={o.id}
              id={`order-card-${o.id}`}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              /*
               * w-full          → card always fills 100% of column width
               * min-w-0         → redundant safety in case article is flex child somewhere
               * No overflow:hidden — clipping is never the answer
               */
              className={cn(
                "w-full min-w-0 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 transition-all duration-300",
                flashingIds[o.id] === "new" && "animate-flash-green",
                flashingIds[o.id] === "updated" && "animate-flash-amber",
                flashingIds[o.id] === "cancelled" && "animate-flash-red"
              )}
            >
              {/* Order header row */}
              <div className="flex items-start justify-between gap-2">
                {/*
                 * min-w-0 lets the left side shrink so the price on the right
                 * never pushes content outside the card.
                 */}
                <div className="min-w-0 flex-1">
                  <div className="break-anywhere font-display text-sm font-semibold flex items-center flex-wrap gap-1">
                    <span>Table {o.tables?.label ?? "?"} · {formatOrderLabel(o.order_number)}</span>
                    {o.version > o.last_reviewed_version && o.last_updated_by === 'customer' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                        UPDATED
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {new Date(o.created_at).toLocaleTimeString()} ·{" "}
                    <StatusBadge status={o.status} />
                  </div>
                </div>
                <div className="shrink-0 text-right font-display text-base font-semibold tabular-nums">
                  {formatMoney(o.total_cents, currency)}
                </div>
              </div>

              {/* Order items list — no per-item notes, names wrap */}
              <ul className="mt-3 space-y-1 text-sm">
                {o.order_items?.map((it) => (
                  <li key={it.id} className="flex items-baseline gap-2">
                    <span className="break-anywhere flex-1">
                      <span className="font-medium tabular-nums">{it.qty}×</span> {it.name}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Order-level note — long notes wrap, never overflow */}
              {o.note && (
                <p className="break-anywhere mt-2 rounded-xl bg-muted/60 p-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Note:</span> {o.note}
                </p>
              )}

              {/* Review changes button */}
              {o.version > o.last_reviewed_version && o.last_updated_by === 'customer' && onReviewChanges && (
                <button
                  onClick={() => onReviewChanges(o)}
                  className="mt-3 w-full rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Review changes
                </button>
              )}

              {/* Action buttons */}
              {(NEXT_STATUS[o.status] || onCancel) && (
                <div className="mt-3 flex gap-2">
                  {NEXT_STATUS[o.status] && (
                    <button
                      onClick={() => onAdvance(o)}
                      className="flex-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft"
                    >
                      {NEXT_LABEL[o.status]}
                    </button>
                  )}
                  {onCancel && o.status !== "served" && o.status !== "cancelled" && (
                    <button
                      onClick={() => onCancel(o)}
                      className="rounded-full bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-destructive/15 hover:text-destructive"
                      aria-label="Cancel order"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const getOrderDiff = (prev: any[] | null, curr: any[]) => {
  const diff: { name: string; qtyDiff: number; prevQty: number; currQty: number }[] = [];
  const prevItems = prev || [];
  
  const prevMap = new Map<string, any>();
  prevItems.forEach(i => {
    const key = i.menu_item_id || i.name;
    prevMap.set(key, i);
  });

  const currMap = new Map<string, any>();
  curr.forEach(i => {
    const key = i.menu_item_id || i.name;
    currMap.set(key, i);
  });

  // Check for changed or removed items
  prevItems.forEach(pi => {
    const key = pi.menu_item_id || pi.name;
    const ci = currMap.get(key);
    if (!ci) {
      // Removed completely
      diff.push({ name: pi.name, qtyDiff: -pi.qty, prevQty: pi.qty, currQty: 0 });
    } else if (ci.qty !== pi.qty) {
      // Quantity changed
      diff.push({ name: pi.name, qtyDiff: ci.qty - pi.qty, prevQty: pi.qty, currQty: ci.qty });
    }
  });

  // Check for new items
  curr.forEach(ci => {
    const key = ci.menu_item_id || ci.name;
    if (!prevMap.has(key)) {
      // Added
      diff.push({ name: ci.name, qtyDiff: ci.qty, prevQty: 0, currQty: ci.qty });
    }
  });

  return diff;
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
    pending: { label: "Pending", icon: Clock, className: "text-warning" },
    preparing: { label: "Preparing", icon: ChefHat, className: "text-accent" },
    ready: { label: "Ready", icon: Sparkles, className: "text-accent" },
    served: { label: "Served", icon: Check, className: "text-success" },
    cancelled: { label: "Cancelled", icon: X, className: "text-destructive" },
  };
  const m = map[status];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", m.className)}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}
