import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, ChefHat, Clock, HandPlatter, Sparkles, X, Utensils, Droplet, Receipt, HelpCircle, Settings, Volume2, Smartphone, AlertTriangle, Filter } from "lucide-react";
import { toast } from "@/components/ui/sonner";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getNotificationSetting, initNotificationSystem } from "@/lib/notificationSystem";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import { calculateOccupiedTables, getTableStatus } from "@/lib/tables/occupancy";
import { markTableFreeInDb, fetchCafeTables } from "@/lib/tables/tableRepository";
import { sortTablesNatural } from "@/lib/tables/naturalTableSort";
import { updateOrderStatusInDb, cancelOrderInDb, fetchCafeOrders } from "@/lib/orders/repository";
import { computeDailyOrderNumbers, sortOrdersByLane } from "@/lib/orders/orderUtils";
import {
  fetchActiveServiceRequests,
  acknowledgeServiceRequestInDb,
  resolveServiceRequestInDb,
} from "@/lib/serviceRequests";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function formatElapsedTime(diffMin: number): string {
  if (diffMin < 1) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin} min`;
  }
  if (diffMin < 1440) {
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hr`;
  }
  if (diffMin < 2880) {
    return "Yesterday";
  }
  const days = Math.floor(diffMin / 1440);
  return `${days} days`;
}

function OrderAgeDisplay({ 
  createdAt, 
  status, 
  priority, 
  diffMin 
}: { 
  createdAt: string; 
  status: string; 
  priority: "green" | "yellow" | "red"; 
  diffMin: number; 
}) {
  if (status === "served" || status === "cancelled") {
    return null;
  }

  const elapsed = formatElapsedTime(diffMin);

  const dotColors = {
    green: "bg-green-500",
    yellow: "bg-amber-500",
    red: "bg-destructive"
  };

  const textColors = {
    green: "text-green-600 dark:text-green-400",
    yellow: "text-amber-600 dark:text-amber-400 font-medium",
    red: "text-destructive font-semibold"
  };

  return (
    <div className="flex items-center gap-2 mt-1 text-[11px]">
      <span className={cn("h-2 w-2 rounded-full shrink-0", dotColors[priority])} />
      <span className={cn("flex items-center gap-2", textColors[priority])}>
        {priority === "red" && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
        <span>{elapsed}</span>
      </span>
    </div>
  );
}

export const getRelativeTime = (date: Date) => {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / 1440)}d ago`;
};

function DiningSessionTimeline({ diningSessionId, currentStatus }: { diningSessionId: string | null; currentStatus?: OrderStatus }) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!diningSessionId) return;
    const channel = supabase
      .channel(`timeline-${diningSessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_events", filter: `dining_session_id=eq.${diningSessionId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["dining-session-timeline", diningSessionId] });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [diningSessionId, qc]);

  const { data: timelineEvents, isLoading } = useQuery({
    queryKey: ["dining-session-timeline", diningSessionId],
    enabled: !!diningSessionId,
    queryFn: async () => {
      if (!diningSessionId) return [];

      const { data: eventsData, error } = await supabase
        .from("order_events")
        .select("*")
        .eq("dining_session_id", diningSessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      return (eventsData ?? []).map(event => ({
        id: event.id,
        title: event.title,
        timestamp: new Date(event.created_at),
        actor: event.actor === "system" ? undefined : (event.actor === "customer" ? "Customer" : "Staff"),
        type: event.actor as "system" | "customer" | "staff",
      }));
    }
  });



  if (isLoading) {
    return <p className="text-xs text-muted-foreground animate-pulse">Loading timeline...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Current order status shown separately */}
      {currentStatus && (
        <div className="flex items-center justify-between border-b border-border/40 pb-3 text-xs">
          <span className="text-muted-foreground font-semibold">Current Order Status</span>
          <StatusBadge status={currentStatus} />
        </div>
      )}

      {!timelineEvents || timelineEvents.length === 0 ? (
        <p className="text-xs text-muted-foreground">No events recorded.</p>
      ) : (
        <div className="relative pl-4 border-l border-border/60 ml-2 space-y-4">
          {timelineEvents.map((event) => {
            const dotColors = {
              system: "bg-muted-foreground/35 ring-muted-foreground/15",
              customer: "bg-warning ring-warning/15",
              staff: "bg-accent ring-accent/15",
            }[event.type];

            const timeStr = event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={event.id} className="relative flex flex-col gap-1 text-xs">
                <span className={cn("absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ring-4", dotColors)} />
                
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-foreground break-anywhere">
                    {event.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                    {timeStr} ({getRelativeTime(event.timestamp)})
                  </span>
                </div>
                
                {event.actor && (
                  <div className="text-[10px] text-muted-foreground">
                    By <span className="font-medium capitalize">{event.actor}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function getOrderLastActivity(
  o: { created_at: string; updated_at?: string | null; dining_session_id?: string | null; session_id?: string | null },
  serviceRequests: { created_at: string; updated_at?: string | null; session_id: string }[]
): number {
  const dates = [
    new Date(o.created_at).getTime(),
    new Date(o.updated_at || o.created_at).getTime()
  ];
  
  const sessionId = o.dining_session_id || o.session_id;
  if (sessionId) {
    const srs = serviceRequests.filter(sr => sr.session_id === sessionId);
    srs.forEach(sr => {
      dates.push(new Date(sr.created_at).getTime());
      dates.push(new Date(sr.updated_at || sr.created_at).getTime());
    });
  }
  
  return Math.max(...dates);
}

export default function StaffDashboardPage() {
  const qc = useQueryClient();
  const { cafe, cafeId } = useCafe();
  const { session } = useAuth();
  const permissions = usePermissions();
  const [selectedTable, setSelectedTable] = useState<TableRow | null>(null);
  const [recentlyDoneFilter, setRecentlyDoneFilter] = useState<"all" | "completed" | "cancelled_customer" | "cancelled_staff">(
    () => (sessionStorage.getItem("orderrail.recently_done_filter") as any) || "all"
  );

  const setFilterAndRemember = (filter: "all" | "completed" | "cancelled_customer" | "cancelled_staff") => {
    setRecentlyDoneFilter(filter);
    sessionStorage.setItem("orderrail.recently_done_filter", filter);
  };

  const [reviewingOrder, setReviewingOrder] = useState<OrderWithItems | null>(null);
  const [flashingIds, setFlashingIds] = useState<Record<string, "new" | "updated" | "sr" | "cancelled">>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [tick, setTick] = useState(0);
  const [selectedDrawerOrder, setSelectedDrawerOrder] = useState<OrderWithItems | null>(null);
  const [focusedSummary, setFocusedSummary] = useState<"incoming" | "preparing" | "ready" | "service_requests" | "overdue" | null>(null);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("orderrail.staff.summary_collapsed") === "true";
    }
    return false;
  });

  const [isSpecialsDialogOpen, setIsSpecialsDialogOpen] = useState(false);
  const [specialsSearchQuery, setSpecialsSearchQuery] = useState("");

  useEffect(() => {
    if (!isSpecialsDialogOpen) {
      setSpecialsSearchQuery("");
    }
  }, [isSpecialsDialogOpen]);

  useEffect(() => {
    const handleOpenSpecials = () => {
      setIsSpecialsDialogOpen(true);
    };
    window.addEventListener("open-specials-dialog", handleOpenSpecials);
    return () => window.removeEventListener("open-specials-dialog", handleOpenSpecials);
  }, []);

  const menuItemsQ = useQuery({
    queryKey: ["staff-menu-items", cafeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("cafe_id", cafeId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!cafeId && isSpecialsDialogOpen,
  });

  const toggleTodaySpecial = async (itemId: string, currentTags: string[] | null) => {
    const tags = currentTags ?? [];
    const isSpecial = tags.includes("Today's Special");
    const newTags = isSpecial
      ? tags.filter((t) => t !== "Today's Special")
      : [...tags, "Today's Special"];

    const { error } = await supabase
      .from("menu_items")
      .update({ tags: newTags })
      .eq("id", itemId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isSpecial ? "Removed from Specials" : "Added to Specials");
      void menuItemsQ.refetch();
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Listen to cross-page card flashing requests from the global layout notifications trigger
  useEffect(() => {
    const handleFlash = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.id && detail.type) {
        setFlashingIds(prev => ({ ...prev, [detail.id]: detail.type }));
        setTimeout(() => {
          setFlashingIds(prev => {
            const copy = { ...prev };
            delete copy[detail.id];
            return copy;
          });
        }, 400);
      }
    };
    window.addEventListener("flash-card", handleFlash);
    return () => window.removeEventListener("flash-card", handleFlash);
  }, []);




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
  }, []);

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
    queryFn: () => fetchCafeOrders(cafeId!),
  });

  // Listen to open-order-drawer requests from notification clicks
  useEffect(() => {
    const handleOpenDrawer = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.orderId) {
        const order = ordersQ.data?.find(o => o.id === detail.orderId);
        if (order) {
          setSelectedDrawerOrder(order);
        }
      }
    };
    window.addEventListener("open-order-drawer", handleOpenDrawer);
    return () => window.removeEventListener("open-order-drawer", handleOpenDrawer);
  }, [ordersQ.data]);

  const srQ = useQuery({
    queryKey: ["staff-sr", cafeId],
    enabled: !!cafeId,
    queryFn: () => fetchActiveServiceRequests(cafeId!),
  });

  const tablesQ = useQuery({
    queryKey: ["staff-tables", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      // Clean up expired browsing sessions before loading table list
      await supabase.rpc("cleanup_expired_browsing_sessions");
      return fetchCafeTables(cafeId!);
    },
  });

  // Realtime: refresh orders + service requests on any change for this cafe.
  useEffect(() => {
    if (!cafeId) return;
    const channel = supabase
      .channel(`staff-${cafeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` }, (payload) => {
        void qc.invalidateQueries({ queryKey: ["staff-orders", cafeId] });
        void qc.invalidateQueries({ queryKey: ["shared-orders", cafeId] });
        void qc.invalidateQueries({ queryKey: ["staff-tables", cafeId] });
        
        if (payload.eventType === "INSERT") {
          const newOrder = payload.new as Order;

          // Flash card green (pulse) if enabled
          if (getNotificationSetting("flashCards")) {
            setFlashingIds(prev => ({ ...prev, [newOrder.id]: "new" }));
            setTimeout(() => {
              setFlashingIds(prev => {
                const copy = { ...prev };
                delete copy[newOrder.id];
                return copy;
              });
            }, 400);
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
        } else if (payload.eventType === "UPDATE") {
          const newOrder = payload.new as Order;
          
          if (newOrder.dining_session_id) {
            void qc.invalidateQueries({ queryKey: ["dining-session-timeline", newOrder.dining_session_id] });
          }
          
          // Case A: Cancelled by customer
          if (newOrder.status === 'cancelled' && newOrder.last_updated_by === 'customer') {
            // Briefly highlight card as cancelled (red flash) for 2 seconds
            if (getNotificationSetting("flashCards")) {
              setFlashingIds(prev => ({ ...prev, [newOrder.id]: "cancelled" }));
              setTimeout(() => {
                setFlashingIds(prev => {
                  const copy = { ...prev };
                  delete copy[newOrder.id];
                  return copy;
                });
              }, 400);
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
          // Case B: Normal update by customer
          else if (newOrder.status !== 'cancelled' && newOrder.version > newOrder.last_reviewed_version && newOrder.last_updated_by === 'customer') {
            // Flash card if enabled
            if (getNotificationSetting("flashCards")) {
              setFlashingIds(prev => ({ ...prev, [newOrder.id]: "updated" }));
              setTimeout(() => {
                setFlashingIds(prev => {
                  const copy = { ...prev };
                  delete copy[newOrder.id];
                  return copy;
                });
              }, 400);
            }

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
            
            if (getNotificationSetting("flashCards")) {
              setFlashingIds(prev => ({ ...prev, [req.id]: "sr" }));
              setTimeout(() => {
                setFlashingIds(prev => {
                  const copy = { ...prev };
                  delete copy[req.id];
                  return copy;
                });
              }, 400);
            }

            if (isIdle()) {
              // Set pending ID to scroll after React renders the new card in the DOM
              pendingScrollRequestIdRef.current = req.id;
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
        }, 400);
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

  const dailyOrderNumMap = useMemo(() => computeDailyOrderNumbers(ordersQ.data ?? []), [ordersQ.data]);

  const grouped = useMemo(() => {
    const orders = ordersQ.data ?? [];
    const serviceRequests = srQ.data ?? [];
    const query = searchQuery.trim().toLowerCase();
    
    const filteredOrders = query
      ? orders.filter(
          (o) =>
            o.tables?.label?.toLowerCase().includes(query) ||
            o.order_number.toString().includes(query) ||
            (dailyOrderNumMap.get(o.id) ?? "").toString().includes(query)
        )
      : orders;

    // Attach lastActivity to each order and sort descending
    const ordersWithActivity = filteredOrders.map((o) => ({
      ...o,
      lastActivity: getOrderLastActivity(o, serviceRequests),
    }));

    let doneOrders = ordersWithActivity.filter((o) => o.status === "served" || o.status === "cancelled");
    if (recentlyDoneFilter === "completed") {
      doneOrders = doneOrders.filter((o) => o.status === "served");
    } else if (recentlyDoneFilter === "cancelled_customer") {
      doneOrders = doneOrders.filter((o) => o.status === "cancelled" && o.last_updated_by === "customer");
    } else if (recentlyDoneFilter === "cancelled_staff") {
      doneOrders = doneOrders.filter((o) => o.status === "cancelled" && o.last_updated_by === "staff");
    }

    return {
      incoming: sortOrdersByLane(ordersWithActivity.filter((o) => o.status === "pending"), "incoming"),
      active: sortOrdersByLane(ordersWithActivity.filter((o) => o.status === "preparing" || o.status === "ready"), "preparing"),
      done: sortOrdersByLane(doneOrders, "history").slice(0, 20),
    };
  }, [ordersQ.data, srQ.data, searchQuery, recentlyDoneFilter]);

  const advance = async (o: OrderWithItems) => {
    const next = NEXT_STATUS[o.status];
    if (!next) return;
    try {
      await updateOrderStatusInDb(o.id, next, "staff");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update order status");
    }
  };

  const cancel = async (o: OrderWithItems) => {
    try {
      await cancelOrderInDb(o.id, "staff");
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel order");
    }
  };

  const resolveSR = async (id: string) => {
    try {
      await resolveServiceRequestInDb(id);
    } catch (error: any) {
      toast.error(error?.message || "Failed to resolve service request");
    }
  };
  const ackSR = async (id: string) => {
    try {
      await acknowledgeServiceRequestInDb(id);
    } catch (error: any) {
      toast.error(error?.message || "Failed to acknowledge service request");
    }
  };

  const handleMarkTableFree = async (table: TableRow) => {
    if (!permissions.canResetTable()) {
      toast.error("403 Forbidden: Staff members cannot reset tables. Please request Counter or Owner assistance.");
      return;
    }
    try {
      await markTableFreeInDb(table.id, table.active_session_id);

      toast.success(`Table ${table.label} marked Free`);
      void tablesQ.refetch();
      void ordersQ.refetch();
      void qc.invalidateQueries({ queryKey: ["staff-tables", cafeId] });
      void qc.invalidateQueries({ queryKey: ["staff-orders", cafeId] });
      void qc.invalidateQueries({ queryKey: ["shared-orders", cafeId] });
      setSelectedTable(null);
    } catch (e: any) {
      console.error(e);
      let friendlyMsg = "Could not free table. Please try again.";

      if (e.message?.includes("active orders")) {
        const activeOrdersCount = (ordersQ.data ?? []).filter((o) =>
          o.dining_session_id === table.active_session_id &&
          (o.status === "pending" || o.status === "preparing" || o.status === "ready")
        ).length;

        if (activeOrdersCount > 0) {
          friendlyMsg = `Cannot free this table because ${activeOrdersCount} active ${
            activeOrdersCount === 1 ? "order still exists" : "orders still exist"
          }.`;
        } else {
          friendlyMsg = "Cannot free this table because active orders still exist.";
        }
      } else if (e.message?.includes("not currently occupied") || e.message?.includes("no active session")) {
        friendlyMsg = "Cannot free this table because no active dining session is open.";
      } else if (e.code === "42501" || e.message?.toLowerCase().includes("permission")) {
        friendlyMsg = "You do not have permission to perform this action.";
      } else if (e.message) {
        friendlyMsg = e.message;
      }

      toast.error(friendlyMsg);
    }
  };

  // AUDITED WORKFLOWS - Sprint 5.3 Operational Validation
  // Verified:
  // - Timeline Event history recording is unique per transition
  // - Recently Done sorting by completion/cancellation time
  // - Filters (All, Completed, Cancelled by Customer, Cancelled by Staff)
  // - Needs Attention limited to 5 items with priority 1-6
  // - Live Queue Summary counts & Table X • Y min oldest calculation
  interface AttentionItem {
    id: string;
    type: "order" | "service_request";
    priority: number;
    title: string;
    timestamp: string;
    tableLabel: string;
    prefix: "Waiting" | "Requested" | "Updated";
    originalData: any;
  }

  const attentionItems = useMemo(() => {
    const orders = ordersQ.data ?? [];
    const srs = srQ.data ?? [];
    
    const items: AttentionItem[] = [];

    // Process Orders
    orders.forEach((o) => {
      if (o.status === "ready") {
        items.push({
          id: `order-${o.id}`,
          type: "order",
          priority: 1,
          title: "Order ready to serve",
          timestamp: o.created_at,
          tableLabel: o.tables?.label ?? "?",
          prefix: "Waiting",
          originalData: o,
        });
      } else if (
        o.status !== "served" &&
        o.status !== "cancelled" &&
        o.version > o.last_reviewed_version &&
        o.last_updated_by === "customer"
      ) {
        items.push({
          id: `order-${o.id}`,
          type: "order",
          priority: 2,
          title: "Customer updated order",
          timestamp: o.updated_at || o.created_at,
          tableLabel: o.tables?.label ?? "?",
          prefix: "Updated",
          originalData: o,
        });
      }
    });

    // Process Service Requests
    srs.forEach((sr) => {
      if (sr.status !== "resolved") {
        let priority = 5;
        let title = "Assistance requested";
        if (sr.type === "bill") {
          priority = 3;
          title = "Bill requested";
        } else if (sr.type === "waiter") {
          priority = 4;
          title = "Waiter requested";
        } else if (sr.type === "help") {
          priority = 5;
          title = "Assistance requested";
        } else if (sr.type === "water") {
          priority = 6;
          title = "Water requested";
        }

        items.push({
          id: `sr-${sr.id}`,
          type: "service_request",
          priority,
          title,
          timestamp: sr.created_at,
          tableLabel: sr.tables?.label ?? "?",
          prefix: "Requested",
          originalData: sr,
        });
      }
    });

    return items.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [ordersQ.data, srQ.data]);

  const triggerServiceRequestFlash = (id: string) => {
    if (getNotificationSetting("flashCards")) {
      setFlashingIds(prev => ({ ...prev, [id]: "sr" }));
      setTimeout(() => {
        setFlashingIds(prev => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
      }, 400);
    }
  };

  const handleScrollToServiceRequest = (srId: string) => {
    const section = document.getElementById("service-requests-section");
    const container = document.getElementById("service-requests-container");
    const cardEl = document.getElementById(`sr-card-${srId}`);

    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (container && cardEl) {
      setTimeout(() => {
        cardEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        triggerServiceRequestFlash(srId);
      }, 300);
    } else if (cardEl) {
      triggerServiceRequestFlash(srId);
    }
  };

  const handleSummaryCardClick = (category: "incoming" | "preparing" | "ready" | "service_requests" | "overdue") => {
    if (focusedSummary === category) {
      setFocusedSummary(null);
    } else {
      setFocusedSummary(category);
      
      if (category === "service_requests") {
        setTimeout(() => {
          const section = document.getElementById("service-requests-section");
          if (section) {
            section.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          const activeSrs = srQ.data?.filter(sr => sr.status !== 'resolved') ?? [];
          const firstActiveId = activeSrs[0]?.id;
          if (firstActiveId) {
            const cardEl = document.getElementById(`sr-card-${firstActiveId}`);
            if (cardEl) {
              setTimeout(() => {
                cardEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
              }, 200);
            }
          }
        }, 100);
      } else if (category === "ready") {
        setTimeout(() => {
          const readyOrders = ordersQ.data?.filter((o) => o.status === "ready") ?? [];
          const oldestReady = readyOrders.reduce((oldest, current) => {
            return new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest;
          }, readyOrders[0]);
          if (oldestReady) {
            const el = document.getElementById(`order-card-${oldestReady.id}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
          }
          const col = document.getElementById("column-preparing");
          if (col) {
            col.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      } else if (category === "overdue") {
        setTimeout(() => {
          const activeOrders = ordersQ.data?.filter(
            (o) => o.status === "pending" || o.status === "preparing" || o.status === "ready"
          ) ?? [];
          const overdue = activeOrders.filter((o) => {
            const diffMs = Date.now() - new Date(o.created_at).getTime();
            return diffMs >= 10 * 60000;
          });
          const oldestOverdue = overdue.reduce((oldest, current) => {
            return new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest;
          }, overdue[0]);
          if (oldestOverdue) {
            const el = document.getElementById(`order-card-${oldestOverdue.id}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
          }
        }, 100);
      } else {
        let elementId = "";
        if (category === "incoming") elementId = "column-incoming";
        else if (category === "preparing") elementId = "column-preparing";

        if (elementId) {
          setTimeout(() => {
            const el = document.getElementById(elementId);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 100);
        }
      }
    }
  };

  const liveQueueSummary = useMemo(() => {
    const orders = ordersQ.data ?? [];
    const srs = srQ.data ?? [];
    const now = Date.now();

    const incoming = orders.filter((o) => o.status === "pending");
    const preparing = orders.filter((o) => o.status === "preparing");
    const ready = orders.filter((o) => o.status === "ready");
    const activeSRs = srs.filter((sr) => sr.status !== "resolved");

    const activeOrders = orders.filter(
      (o) => o.status === "pending" || o.status === "preparing" || o.status === "ready"
    );
    const overdue = activeOrders.filter((o) => {
      const diffMs = now - new Date(o.created_at).getTime();
      return diffMs >= 10 * 60000;
    });

    const getOldestTime = (items: { created_at: string; tables?: { label: string } | null }[]) => {
      if (items.length === 0) return "Table - • -";
      const oldestItem = items.reduce((oldest, current) => {
        return new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest;
      });
      const diffMs = now - new Date(oldestItem.created_at).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const oldestTableLabel = oldestItem.tables?.label ?? "-";
      return `Table ${oldestTableLabel} • ${formatElapsedTime(diffMin)}`;
    };

    return {
      incoming: { count: incoming.length, oldest: getOldestTime(incoming) },
      preparing: { count: preparing.length, oldest: getOldestTime(preparing) },
      ready: { count: ready.length, oldest: getOldestTime(ready) },
      serviceRequests: { count: activeSRs.length, oldest: getOldestTime(activeSRs) },
      overdue: { count: overdue.length, oldest: getOldestTime(overdue) },
    };
  }, [ordersQ.data, srQ.data, tick]);

  const currency = cafe?.currency ?? "INR";
  const openSRTables = new Set((srQ.data ?? []).map((s) => s.table_id));
  const occupiedTablesCount = useMemo(
    () => calculateOccupiedTables((tablesQ.data ?? []) as TableRow[], (ordersQ.data ?? []) as any[]).length,
    [tablesQ.data, ordersQ.data]
  );

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Manage active orders and service requests in real-time.</p>
        </div>
        <div className="flex items-center gap-2">
          <GlobalNotificationControls />
        </div>
      </div>

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
      <section
        id="service-requests-section"
        className={cn(
          "transition-opacity duration-300",
          focusedSummary && focusedSummary !== "service_requests" && "opacity-80"
        )}
      >
        <h2 className="mb-3 font-display text-lg font-semibold">Service requests</h2>
        {(srQ.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center text-xs text-muted-foreground">
            No service requests.
          </div>
        ) : (
          <div 
            id="service-requests-container" 
            /* horizontal-thin-scrollbar shows a thin custom scrollbar on desktop,
               and native overlay scrollbar on mobile.
               scroll-snap-type x mandatory + snap-start on cards gives
               the snapping behaviour. */
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
        )}
      </section>
      {/* Live Queue Summary Row */}
      <div className="flex items-center justify-between px-1 mt-4 mb-2">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
          </span>
          Live Queue Summary
        </h3>
        <button
          onClick={() => {
            setIsSummaryCollapsed((prev) => {
              const next = !prev;
              localStorage.setItem("orderrail.staff.summary_collapsed", String(next));
              return next;
            });
          }}
          className="text-xs font-semibold text-accent hover:underline transition-colors"
        >
          {isSummaryCollapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {!isSummaryCollapsed && (
        <section className="horizontal-thin-scrollbar flex gap-3 overflow-x-auto pb-3.5 snap-x snap-mandatory sm:grid sm:grid-cols-5 sm:pb-0 sm:overflow-x-visible">
          <div
            onClick={() => handleSummaryCardClick("incoming")}
            className={cn(
              "min-w-[140px] shrink-0 snap-center sm:min-w-0 sm:shrink-0 rounded-2xl border p-3 shadow-soft cursor-pointer transition-all hover:bg-muted/50 flex flex-col justify-between",
              focusedSummary === "incoming"
                ? "ring-2 ring-warning border-transparent bg-warning/5 font-semibold"
                : "border-border bg-card",
              focusedSummary && focusedSummary !== "incoming" && "opacity-80"
            )}
          >
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Incoming</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold font-display tabular-nums text-foreground">
                {liveQueueSummary.incoming.count}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {liveQueueSummary.incoming.oldest}
              </span>
            </div>
          </div>

          <div
            onClick={() => handleSummaryCardClick("preparing")}
            className={cn(
              "min-w-[140px] shrink-0 snap-center sm:min-w-0 sm:shrink-0 rounded-2xl border p-3 shadow-soft cursor-pointer transition-all hover:bg-muted/50 flex flex-col justify-between",
              focusedSummary === "preparing"
                ? "ring-2 ring-accent border-transparent bg-accent/5 font-semibold"
                : "border-border bg-card",
              focusedSummary && focusedSummary !== "preparing" && "opacity-80"
            )}
          >
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Preparing</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold font-display tabular-nums text-foreground">
                {liveQueueSummary.preparing.count}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {liveQueueSummary.preparing.oldest}
              </span>
            </div>
          </div>

          <div
            onClick={() => handleSummaryCardClick("ready")}
            className={cn(
              "min-w-[140px] shrink-0 snap-center sm:min-w-0 sm:shrink-0 rounded-2xl border p-3 shadow-soft cursor-pointer transition-all hover:bg-muted/50 flex flex-col justify-between",
              focusedSummary === "ready"
                ? "ring-2 ring-success border-transparent bg-success/5 font-semibold"
                : "border-border bg-card",
              focusedSummary && focusedSummary !== "ready" && "opacity-80"
            )}
          >
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ready</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold font-display tabular-nums text-foreground">
                {liveQueueSummary.ready.count}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {liveQueueSummary.ready.oldest}
              </span>
            </div>
          </div>

          <div
            onClick={() => handleSummaryCardClick("service_requests")}
            className={cn(
              "min-w-[140px] shrink-0 snap-center sm:min-w-0 sm:shrink-0 rounded-2xl border p-3 shadow-soft cursor-pointer transition-all hover:bg-muted/50 flex flex-col justify-between",
              focusedSummary === "service_requests"
                ? "ring-2 ring-destructive border-transparent bg-destructive/5 font-semibold"
                : "border-border bg-card",
              focusedSummary && focusedSummary !== "service_requests" && "opacity-80"
            )}
          >
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Requests</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold font-display tabular-nums text-foreground">
                {liveQueueSummary.serviceRequests.count}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {liveQueueSummary.serviceRequests.oldest}
              </span>
            </div>
          </div>

          <div
            onClick={() => handleSummaryCardClick("overdue")}
            className={cn(
              "min-w-[140px] shrink-0 snap-center sm:min-w-0 sm:shrink-0 rounded-2xl border p-3 shadow-soft cursor-pointer transition-all hover:bg-muted/50 flex flex-col justify-between",
              focusedSummary === "overdue"
                ? "ring-2 ring-destructive border-transparent bg-destructive/10 text-destructive font-semibold"
                : "border-border bg-card",
              focusedSummary && focusedSummary !== "overdue" && "opacity-80"
            )}
          >
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Overdue</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold font-display tabular-nums text-foreground">
                {liveQueueSummary.overdue.count}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {liveQueueSummary.overdue.oldest}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Needs Attention Panel */}
      <section className="rounded-3xl border border-border bg-card/60 backdrop-blur-md p-5 shadow-soft ring-1 ring-border/50 transition-all">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={cn("relative inline-flex rounded-full h-2 w-2", attentionItems.length > 0 ? "bg-destructive" : "bg-success")}></span>
            </span>
            <h2 className="font-display text-base font-semibold text-foreground">Needs Attention</h2>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
            {attentionItems.length} {attentionItems.length === 1 ? "task" : "tasks"}
          </span>
        </div>

        {attentionItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="h-5 w-5" />
            </div>
            <p className="mt-2 text-xs font-semibold text-foreground">Everything is under control</p>
          </div>
        ) : (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {attentionItems.slice(0, 5).map((item) => {
                const priorityColors = {
                  1: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400 font-bold",
                  2: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold",
                  3: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold",
                  4: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
                  5: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
                  6: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
                }[item.priority as 1|2|3|4|5|6];

                const priorityLabel = {
                  1: "Critical",
                  2: "High",
                  3: "High",
                  4: "Medium",
                  5: "Medium",
                  6: "Medium",
                }[item.priority as 1|2|3|4|5|6];

                const Icon = {
                  1: Utensils,
                  2: Sparkles,
                  3: Receipt,
                  4: HandPlatter,
                  5: HelpCircle,
                  6: Droplet,
                }[item.priority as 1|2|3|4|5|6];

                const diffMs = Date.now() - new Date(item.timestamp).getTime();
                const diffMin = Math.floor(diffMs / 60000);
                const elapsed = formatElapsedTime(diffMin);
                const elapsedStr = elapsed === "just now"
                  ? `${item.prefix} just now`
                  : (item.prefix === "Waiting" ? `${item.prefix} ${elapsed}` : `${item.prefix} ${elapsed} ago`);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.type === "order") {
                        setSelectedDrawerOrder(item.originalData);
                      } else {
                        handleScrollToServiceRequest(item.originalData.id);
                      }
                    }}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card/40 p-3.5 shadow-sm cursor-pointer hover:bg-card/70 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", priorityColors)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-xs font-bold text-foreground">
                          Table {item.tableLabel}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground break-anywhere leading-snug">
                          {item.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10px]">
                      <span className="text-muted-foreground">{elapsedStr}</span>
                      <span className={cn("rounded-full border px-2 py-0.5 font-bold uppercase tracking-wider text-[8px]", priorityColors)}>
                        {priorityLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {attentionItems.length > 5 && (
              <div className="mt-4 text-center border-t border-border/40 pt-3">
                <span className="text-xs font-bold text-muted-foreground">
                  +{attentionItems.length - 5} more items
                </span>
              </div>
            )}
          </>
        )}
      </section>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Search by table or order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-border bg-card pl-4 pr-10 py-1.5 text-xs shadow-soft focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2 text-muted-foreground hover:text-foreground transition"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="absolute right-3 top-2.5 text-muted-foreground/60">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          )}
        </div>
      </div>

      {/* Orders kanban — CSS Grid, each column min-width:0 to respect track width */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div
          id="column-incoming"
          className={cn(
            "transition-opacity duration-300",
            focusedSummary && focusedSummary !== "incoming" && "opacity-80"
          )}
        >
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
            onSelectOrder={setSelectedDrawerOrder}
            focusedSummary={focusedSummary}
          />
        </div>
        <div
          id="column-preparing"
          className={cn(
            "transition-opacity duration-300",
            focusedSummary && focusedSummary !== "preparing" && focusedSummary !== "ready" && "opacity-80"
          )}
        >
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
            onSelectOrder={setSelectedDrawerOrder}
            focusedSummary={focusedSummary}
          />
        </div>
        <div
          id="column-done"
          className={cn(
            "transition-opacity duration-300",
            focusedSummary && "opacity-80"
          )}
        >
          <OrderColumn
            title="Recently done"
            accent="success"
            orders={grouped.done}
            currency={currency}
            onAdvance={advance}
            onReviewChanges={setReviewingOrder}
            flashingIds={flashingIds}
            emptyLabel="No completed orders yet."
            onSelectOrder={setSelectedDrawerOrder}
            focusedSummary={focusedSummary}
            headerAction={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    id="recently-done-filter-btn"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Filter recently done orders"
                  >
                    <Filter className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuRadioGroup
                    value={recentlyDoneFilter}
                    onValueChange={(val) => setFilterAndRemember(val as any)}
                  >
                    <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="completed">Completed</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="cancelled_customer">Cancelled by Customer</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="cancelled_staff">Cancelled by Staff</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        </div>
      </section>

      {/* Tables grid */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Tables</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {sortTablesNatural((tablesQ.data ?? []) as TableRow[]).map((t) => {
            const { isOccupied } = getTableStatus(t as TableRow, (ordersQ.data ?? []) as any[]);
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
            const statusInfo = getTableStatus(selectedTable, (ordersQ.data ?? []) as any[]);
            const isOccupied = statusInfo.isOccupied;
            const activeOrdersCount = statusInfo.activeOrders.length;
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
                    Current status: <span className="font-semibold text-foreground capitalize">{isOccupied ? "Occupied" : "Free"}</span>
                  </p>
                  
                  <div className="mt-6 flex flex-col gap-2">
                    {isOccupied ? (
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
                  Table {reviewingOrder.tables?.label ?? "?"} · {formatOrderLabel(dailyOrderNumMap.get(reviewingOrder.id) ?? reviewingOrder.order_number)} has been updated.
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
                {reviewingOrder.version > reviewingOrder.last_reviewed_version &&
                  reviewingOrder.last_updated_by === 'customer' &&
                  reviewingOrder.status !== 'served' &&
                  reviewingOrder.status !== 'cancelled' && (
                    <button
                      onClick={() => void handleAcknowledge(reviewingOrder.id, reviewingOrder.version)}
                      className="rounded-full btn-primary-action px-4 py-2 text-sm font-semibold"
                    >
                      Acknowledge Changes
                    </button>
                  )}
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>

      {/* Order Details Drawer */}
      <Sheet open={!!selectedDrawerOrder} onOpenChange={(open) => !open && setSelectedDrawerOrder(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col justify-between p-6">
          {selectedDrawerOrder && (() => {
            const diffMs = Date.now() - new Date(selectedDrawerOrder.created_at).getTime();
            const diffMin = Math.floor(diffMs / 60000);
            
            let priority: "green" | "yellow" | "red" = "green";
            if (selectedDrawerOrder.status !== "served" && selectedDrawerOrder.status !== "cancelled") {
              if (diffMin >= 10) {
                priority = "red";
              } else if (diffMin >= 5) {
                priority = "yellow";
              }
            }

            const priorityText = {
              green: "Normal Priority",
              yellow: "Attention Needed",
              red: "Immediate Attention Required"
            }[priority];

            const priorityColor = {
              green: "text-green-600 dark:text-green-400",
              yellow: "text-amber-600 dark:text-amber-400 font-semibold",
              red: "text-destructive font-bold"
            }[priority];

            const isUpdated = selectedDrawerOrder.version > selectedDrawerOrder.last_reviewed_version && selectedDrawerOrder.last_updated_by === 'customer';

            return (
              <div className="flex-1 flex flex-col justify-between h-full space-y-6">
                <div className="space-y-6">
                  <SheetHeader className="text-left border-b border-border pb-4">
                    <div className="flex items-center justify-between">
                      <SheetTitle className="font-display text-xl font-bold">
                        Table {selectedDrawerOrder.tables?.label ?? "?"}
                      </SheetTitle>
                      <StatusBadge status={selectedDrawerOrder.status} />
                    </div>
                    <SheetDescription className="text-xs text-muted-foreground">
                      {formatOrderLabel(dailyOrderNumMap.get(selectedDrawerOrder.id) ?? selectedDrawerOrder.order_number)} · Received {new Date(selectedDrawerOrder.created_at).toLocaleTimeString()}
                    </SheetDescription>
                  </SheetHeader>

                  {/* Priority & Age Banner */}
                  <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        priority === "green" && "bg-green-500",
                        priority === "yellow" && "bg-amber-500",
                        priority === "red" && "bg-destructive animate-pulse"
                      )} />
                      <span className={cn("font-semibold", priorityColor)}>{priorityText}</span>
                    </div>
                    <span className="text-muted-foreground">{formatElapsedTime(diffMin)}</span>
                  </div>

                  {/* Customer Review Changes Alert */}
                  {isUpdated && selectedDrawerOrder.status !== "served" && selectedDrawerOrder.status !== "cancelled" && (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        Customer Modified Order
                      </div>
                      <div className="space-y-2">
                        {(() => {
                          const diff = getOrderDiff(selectedDrawerOrder.previous_items, selectedDrawerOrder.order_items);
                          return diff.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No item quantity changes (notes updated).</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {diff.map((item, idx) => {
                                const isAdded = item.qtyDiff > 0;
                                return (
                                  <li
                                    key={idx}
                                    className={cn(
                                      "flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium border",
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
                          );
                        })()}
                      </div>
                      <button
                        onClick={async () => {
                          await handleAcknowledge(selectedDrawerOrder.id, selectedDrawerOrder.version);
                          const updatedOrders = await ordersQ.refetch();
                          const latest = updatedOrders.data?.find(o => o.id === selectedDrawerOrder.id);
                          if (latest) setSelectedDrawerOrder(latest);
                        }}
                        className="w-full rounded-full border border-transparent bg-amber-500 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-amber-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                      >
                        Acknowledge Changes
                      </button>
                    </div>
                  )}

                  {/* Order Items Receipt List */}
                  <div className="space-y-3">
                    <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Receipt Items</h4>
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                      <ul className="space-y-2 text-sm divide-y divide-border/40">
                        {selectedDrawerOrder.order_items?.map((it, idx) => (
                          <li key={it.id} className={cn("flex justify-between py-1.5", idx > 0 && "pt-2")}>
                            <div className="min-w-0 flex-1 pr-2">
                              <span className="font-medium tabular-nums">{it.qty}×</span> {it.name}
                            </div>
                            <span className="shrink-0 text-muted-foreground tabular-nums">
                              {formatMoney(it.price_cents * it.qty, currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex justify-between pt-3 border-t border-border text-sm font-bold">
                        <span>Total Amount</span>
                        <span className="tabular-nums">{formatMoney(selectedDrawerOrder.total_cents, currency)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Notes */}
                  {selectedDrawerOrder.note && (
                    <div className="space-y-2">
                      <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Customer Notes</h4>
                      <div className="rounded-2xl border border-border bg-muted/40 p-4">
                        <p className="text-xs text-foreground italic">"{selectedDrawerOrder.note}"</p>
                      </div>
                    </div>
                  )}

                  {/* Timeline History */}
                  <div className="space-y-2">
                    <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Session Timeline</h4>
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <DiningSessionTimeline diningSessionId={selectedDrawerOrder.dining_session_id} currentStatus={selectedDrawerOrder.status} />
                    </div>
                  </div>
                </div>

                {/* Drawer Footer Actions */}
                <div className="border-t border-border pt-4 mt-6 space-y-2">
                  {NEXT_STATUS[selectedDrawerOrder.status] && (
                    <button
                      onClick={async () => {
                        await advance(selectedDrawerOrder);
                        const updatedOrders = await ordersQ.refetch();
                        const latest = updatedOrders.data?.find(o => o.id === selectedDrawerOrder.id);
                        if (latest) setSelectedDrawerOrder(latest);
                      }}
                      className="w-full rounded-full btn-primary-action py-2.5 text-sm font-semibold"
                    >
                      {NEXT_LABEL[selectedDrawerOrder.status]}
                    </button>
                  )}
                  
                  {selectedDrawerOrder.status !== "served" && selectedDrawerOrder.status !== "cancelled" && (
                    <button
                      onClick={async () => {
                        if (confirm("Are you sure you want to cancel this order?")) {
                          await cancel(selectedDrawerOrder);
                          setSelectedDrawerOrder(null);
                        }
                      }}
                      className="w-full rounded-full bg-secondary py-2.5 text-sm font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                    >
                      Cancel Order
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedDrawerOrder(null)}
                    className="w-full rounded-full bg-secondary py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 transition"
                  >
                    Close Workspace
                  </button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {isSpecialsDialogOpen && (
        <Dialog open={isSpecialsDialogOpen} onOpenChange={setIsSpecialsDialogOpen}>
          <DialogContent className="max-w-md w-full max-h-[85vh] flex flex-col p-6 rounded-3xl bg-card border border-border">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold">Today's Specials</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Toggle "Today's Special" label for your menu items. Customers will see these highlighted on the menu.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2">
              <input
                type="text"
                placeholder="Search items by name..."
                value={specialsSearchQuery}
                onChange={(e) => setSpecialsSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card pl-4 pr-4 py-2 text-xs shadow-soft focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-4">
              {menuItemsQ.isLoading ? (
                <div className="text-center text-xs py-8 text-muted-foreground">Loading items...</div>
              ) : !menuItemsQ.data || menuItemsQ.data.length === 0 ? (
                <div className="text-center text-xs py-8 text-muted-foreground">No menu items found.</div>
              ) : (() => {
                const filtered = menuItemsQ.data.filter((item) =>
                  item.name.toLowerCase().includes(specialsSearchQuery.toLowerCase())
                );
                if (filtered.length === 0) {
                  return (
                    <div className="text-center text-xs py-8 text-muted-foreground">
                      No menu items match your search.
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    {filtered.map((item) => {
                      const isSpecial = item.tags?.includes("Today's Special") ?? false;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-2xl border border-border bg-card/50 hover:bg-card hover:shadow-soft transition-all"
                        >
                          <div>
                            <div className="text-xs font-semibold text-foreground">{item.name}</div>
                            {item.description && (
                              <div className="text-[10px] text-muted-foreground line-clamp-1">{item.description}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => void toggleTodaySpecial(item.id, item.tags)}
                            className={cn(
                              "rounded-full px-3 py-1 text-[10px] font-semibold border transition-all active:scale-95",
                              isSpecial
                                ? "bg-rose-500 border-rose-500 text-white shadow-sm"
                                : "bg-background border-border text-muted-foreground hover:bg-secondary"
                            )}
                          >
                            {isSpecial ? "Special" : "Normal"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            
            <DialogFooter className="mt-4">
              <button
                type="button"
                onClick={() => setIsSpecialsDialogOpen(false)}
                className="w-full rounded-full bg-secondary py-2.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Close
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
  onSelectOrder,
  headerAction,
  focusedSummary,
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
  onSelectOrder: (o: OrderWithItems) => void;
  headerAction?: React.ReactNode;
  focusedSummary?: "incoming" | "preparing" | "ready" | "service_requests" | "overdue" | null;
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
        <div className="flex items-center gap-2">
          {headerAction}
          <span className="text-xs text-muted-foreground tabular-nums">{orders.length}</span>
        </div>
      </div>

      {/*
       * Card list:
       *   - kanban-scroll     → thin custom scrollbar, overflow-y:auto, overflow-x:hidden
       *   - max-h-[520px]     → caps the scrolling area height (not the whole column)
       *   - min-h-[80px]      → empty columns show a sensible height instead of collapsing
       * This is the ONLY element that scrolls vertically; horizontal scroll is impossible.
              */}
      <div className="kanban-scroll max-h-[520px] min-h-[80px] space-y-3 px-1 py-1">
        <AnimatePresence initial={false}>
          {orders.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
              {emptyLabel}
            </p>
          )}
          {orders.map((o) => {
            const diffMs = Date.now() - new Date(o.created_at).getTime();
            const diffMin = Math.floor(diffMs / 60000);
            
            let priority: "green" | "yellow" | "red" = "green";
            if (o.status !== "served" && o.status !== "cancelled") {
              if (diffMin >= 10) {
                priority = "red";
              } else if (diffMin >= 5) {
                priority = "yellow";
              }
            }

            const priorityRing = {
              green: "ring-border/60 shadow-soft bg-card",
              yellow: "ring-amber-500/40 bg-amber-500/[0.04] shadow-soft ring-2",
              red: "ring-destructive/50 bg-destructive/[0.02] shadow-md ring-2"
            }[priority];

             const nextLabel = {
              pending: "Start Preparing",
              preparing: "Mark Ready",
              ready: "Mark Served",
              served: null,
              cancelled: null,
            }[o.status];

            const isOverdue = (o.status === "pending" || o.status === "preparing" || o.status === "ready") && diffMin >= 10;
            
            let isDimmed = false;
            let isFocused = false;

            if (focusedSummary) {
              if (focusedSummary === "preparing") {
                if (o.status !== "preparing") {
                  isDimmed = true;
                } else {
                  isFocused = true;
                }
              } else if (focusedSummary === "ready") {
                if (o.status !== "ready") {
                  isDimmed = true;
                } else {
                  isFocused = true;
                }
              } else if (focusedSummary === "overdue") {
                if (!isOverdue) {
                  isDimmed = true;
                } else {
                  isFocused = true;
                }
              }
            }

            return (
              <motion.article
                key={o.id}
                id={`order-card-${o.id}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onClick={() => onSelectOrder(o)}
                /*
                 * w-full          → card always fills 100% of column width
                 * min-w-0         → redundant safety in case article is flex child somewhere
                 * No overflow:hidden — clipping is never the answer
                 */
                className={cn(
                  "w-full min-w-0 rounded-2xl p-4 transition-all duration-300 cursor-pointer hover:shadow-md hover:ring-primary/45",
                  priorityRing,
                  flashingIds[o.id] === "new" && "animate-flash-green",
                  flashingIds[o.id] === "updated" && "animate-flash-amber",
                  flashingIds[o.id] === "cancelled" && "animate-flash-red",
                  isDimmed && "opacity-80",
                  focusedSummary === "overdue" && isOverdue && "ring-destructive/80 ring-2 shadow-lg"
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
                      <span>Table {o.tables?.label ?? "?"} · {formatOrderLabel(dailyOrderNumMap.get(o.id) ?? o.order_number)}</span>
                      {o.version > o.last_reviewed_version && o.last_updated_by === 'customer' && o.status !== 'served' && o.status !== 'cancelled' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                          UPDATED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      {new Date(o.created_at).toLocaleTimeString()} ·{" "}
                      <StatusBadge status={o.status} />
                    </div>
                    <OrderAgeDisplay createdAt={o.created_at} status={o.status} priority={priority} diffMin={diffMin} />
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-right font-display text-base font-semibold tabular-nums">
                      {formatMoney(o.total_cents, currency)}
                    </span>
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

                {/* Action buttons bottom row */}
                {(NEXT_STATUS[o.status] || (onCancel && o.status !== "served" && o.status !== "cancelled")) && (
                  <div className="mt-4 flex gap-2">
                    {NEXT_STATUS[o.status] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAdvance(o);
                        }}
                        className="flex-1 h-9 rounded-xl btn-primary-action px-4 text-xs font-semibold"
                      >
                        {NEXT_LABEL[o.status]}
                      </button>
                    )}
                    {onCancel && o.status !== "served" && o.status !== "cancelled" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancel(o);
                        }}
                        className="w-9 h-9 rounded-xl bg-secondary hover:bg-destructive/15 hover:text-destructive text-secondary-foreground transition-colors shrink-0 flex items-center justify-center"
                        aria-label="Cancel order"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </motion.article>
            );
          })}
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
